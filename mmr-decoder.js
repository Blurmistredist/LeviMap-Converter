// LeviMap MMR1 decoder.
// MMR1 file: 12-byte header; N directory records of 28 bytes; then N payloads.
// Directory record: tile id at byte 0, compressed length at +20, CRC32 at +24.
// Payload is either zlib-compressed 16x16x7 tile data or sparse pixel records.
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function crc32(u){let c=0xffffffff;for(let i=0;i<u.length;i++)c=CRC_TABLE[(c^u[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function u32(v,o){return v.getUint32(o,true);}
async function inflateZlib(bytes){
 if(!('DecompressionStream'in self))throw new Error('This browser lacks native DEFLATE decompression. Update Chrome.');
 const ds=new DecompressionStream('deflate');
 const stream=new Blob([bytes]).stream().pipeThrough(ds);
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function decodeMmr(file){
 const data=new Uint8Array(await file.arrayBuffer());
 if(data.length<40||String.fromCharCode(...data.slice(0,4))!=='MMR1')throw new Error(file.name+': invalid MMR1 file');
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 let chosen=null;
 // Entry count is not stored as a simple field; locate the directory/payload boundary
 // by matching summed payload lengths and validating each record's compressed CRC.
 for(let n=1;n<=256;n++){
  const base=12+28*n;if(base>data.length)break;
  let total=base,valid=true;
  for(let i=0;i<n;i++){const off=12+i*28;const size=u32(view,off+20);if(size>data.length){valid=false;break;}total+=size;}
  if(!valid||total!==data.length)continue;
  let p=base;
  for(let i=0;i<n;i++){const off=12+i*28,size=u32(view,off+20);const comp=data.subarray(p,p+size);p+=size;if(crc32(comp)!==u32(view,off+24)){valid=false;break;}}
  if(valid){chosen={n,base};break;}
 }
 if(!chosen)throw new Error(file.name+': could not validate MMR1 tile directory');
 const tiles=new Map();let p=chosen.base;
 for(let i=0;i<chosen.n;i++){
  const off=12+i*28,id=data[off],size=u32(view,off+20),comp=data.subarray(p,p+size);p+=size;
  let raw;
  try{raw=await inflateZlib(comp);}
  catch(err){
   if(comp.length<2)throw new Error(file.name+': invalid sparse tile');
   const count=comp[0]|(comp[1]<<8);
   if(comp.length!==2+count*9)throw new Error(file.name+': unsupported tile compression at tile '+id);
   raw=new Uint8Array(16*16*7);let q=2;
   for(let j=0;j<count;j++){const idx=comp[q]|(comp[q+1]<<8);q+=2;if(idx<1||idx>256)throw new Error(file.name+': invalid sparse pixel index '+idx);raw.set(comp.subarray(q,q+7),(idx-1)*7);q+=7;}
  }
  if(raw.length!==16*16*7)throw new Error(file.name+': unexpected decoded tile size '+raw.length);
  if(tiles.has(id))throw new Error(file.name+': duplicate tile ID '+id);
  tiles.set(id,raw);
 }
 return tiles;
}
async function decodeAndStitch(files,onProgress){
 const parsed=[];
 for(let i=0;i<files.length;i++){
  const f=files[i],m=f.webkitRelativePath||f.name;
  const match=m.match(/region_(-?\d+)_(-?\d+)\.mmr$/i);
  if(!match)continue;
  const rx=Number(match[1]),ry=Number(match[2]),tiles=await decodeMmr(f);
  parsed.push({rx,ry,tiles});
  onProgress(Math.round((i+1)/files.length*35),`Decoded region ${i+1} of ${files.length}…`);
 }
 if(!parsed.length)throw new Error('No valid region files selected.');
 const minX=Math.min(...parsed.map(x=>x.rx)),maxX=Math.max(...parsed.map(x=>x.rx));
 const minY=Math.min(...parsed.map(x=>x.ry)),maxY=Math.max(...parsed.map(x=>x.ry));
 const width=(maxX-minX+1)*256,height=(maxY-minY+1)*256;
 if(!Number.isSafeInteger(width*height)||width<=0||height<=0)throw new Error('Invalid map dimensions.');
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:false});if(!ctx)throw new Error('Could not allocate map canvas. Try a device with more memory.');
 let tileCount=0;
 for(let ri=0;ri<parsed.length;ri++){
  const r=parsed[ri],baseX=(r.rx-minX)*256,baseY=(r.ry-minY)*256;
  for(const [id,raw] of r.tiles){
   const rgba=new Uint8ClampedArray(256*4);
   for(let px=0;px<256;px++){const s=px*7,d=px*4;rgba[d]=raw[s];rgba[d+1]=raw[s+1];rgba[d+2]=raw[s+2];rgba[d+3]=raw[s+3];}
   const tile=new ImageData(rgba,16,16);
   ctx.putImageData(tile,baseX+(id%16)*16,baseY+Math.floor(id/16)*16);tileCount++;
  }
  onProgress(35+Math.round((ri+1)/parsed.length*60),`Stitching region ${ri+1} of ${parsed.length}…`);
  await new Promise(requestAnimationFrame);
 }
 onProgress(98,'Encoding full-resolution PNG…');
 return {canvas,width,height,tileCount};
}
// Simple uncompressed ZIP writer: preserves exact PNG bytes and TXT text.
function makeZip(items){
 const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
 for(const item of items){
  const name=enc.encode(item.name),data=item.data instanceof Uint8Array?item.data:new Uint8Array(item.data),crc=crc32(data);
  const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0,true);lv.setUint16(8,0,true);
  lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);lv.setUint16(28,0,true);local.set(name,30);
  locals.push(local,data);
  const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0,true);cv.setUint16(10,0,true);
  cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,offset,true);c.set(name,46);centrals.push(c);offset+=local.length+data.length;
 }
 const centralSize=centrals.reduce((s,a)=>s+a.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
 ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,items.length,true);ev.setUint16(10,items.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);ev.setUint16(20,0,true);
 return new Blob([...locals,...centrals,end],{type:'application/zip'});
}