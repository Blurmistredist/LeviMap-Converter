// Minimal ZIP reader for stored and DEFLATE ZIP entries. Uses the browser's native inflater.
async function readZip(file){
 const buf=await file.arrayBuffer(),v=new DataView(buf),u8=new Uint8Array(buf);
 let eocd=-1;
 for(let p=Math.max(0,buf.byteLength-65557);p<=buf.byteLength-22;p++)if(v.getUint32(p,true)===0x06054b50)eocd=p;
 if(eocd<0)throw new Error('ZIP directory not found');
 const count=v.getUint16(eocd+10,true),cdSize=v.getUint32(eocd+12,true),cdOff=v.getUint32(eocd+16,true);
 if(count===0xffff||cdOff===0xffffffff)throw new Error('ZIP64 archives are not supported in this build');
 const decoder=new TextDecoder();let p=cdOff,out=[];
 for(let i=0;i<count;i++){
  if(v.getUint32(p,true)!==0x02014b50)throw new Error('Invalid ZIP directory entry');
  const method=v.getUint16(p+10,true),csize=v.getUint32(p+20,true),usize=v.getUint32(p+24,true);
  const nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),local=v.getUint32(p+42,true);
  const name=decoder.decode(u8.slice(p+46,p+46+nl));p+=46+nl+el+cl;
  if(name.endsWith('/'))continue;
  if(usize>500*1024*1024)throw new Error('An archive entry is larger than the 500 MB safety limit');
  const lnl=v.getUint16(local+26,true),lel=v.getUint16(local+28,true),start=local+30+lnl+lel;
  const compressed=u8.slice(start,start+csize);let data;
  if(method===0)data=compressed;
  else if(method===8){
   if(!('DecompressionStream'in self))throw new Error('This browser does not support ZIP decompression. Try current Chrome.');
   const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
   data=new Uint8Array(await new Response(stream).arrayBuffer());
  }else continue;
  if(data.byteLength!==usize)throw new Error('ZIP entry size mismatch: '+name);
  out.push({name,data});
 }
 return out;
}