/* Select measured conditions without mixing humidity or operating temperature. */
(function(root){
 function choices(mode){return mode==='single'?[['@concentrations','All concentrations · selected gas'],['@gases','All gases & concentrations · same RH']]:[['@ethanol','All ethanol levels · fixed acetone'],['@acetone','All acetone levels · fixed ethanol'],['@mixtures','All 12 mixtures']];}
 function select(all,selected,choice,temperature){
  if(!choice)return [];
  return all.filter(c=>c.id!==selected.id&&c.mode===selected.mode&&c.temperatures.includes(Number(temperature))).filter(c=>{
   if(choice==='@concentrations')return c.gas===selected.gas&&c.rh===selected.rh;
   if(choice==='@gases')return c.rh===selected.rh;
   if(choice==='@ethanol')return c.acetone===selected.acetone;
   if(choice==='@acetone')return c.ethanol===selected.ethanol;
   if(choice==='@mixtures')return true;
   return c.id===choice;
  }).sort((a,b)=>a.mode==='single'?a.gas.localeCompare(b.gas)||a.concentration-b.concentration:a.ethanol-b.ethanol||a.acetone-b.acetone);
 }
 const api={choices,select};root.EISComparison=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
