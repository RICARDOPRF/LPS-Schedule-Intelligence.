(()=>{
'use strict';

const DISCIPLINES=['Elétrica','Mecânica','Tubulação','Fabricação de Tubulação','Montagem de Tubulação','Suportes','Equipamentos','Estrutura','Instrumentação','Automação','Refratário','Civil','Pintura','Andaime','Comissionamento'];
const BLACK='FF000000',WHITE='FFFFFFFF',BLUE='FF1E3A8A';
const BORDER={top:{style:'thin',color:{argb:BLACK}},left:{style:'thin',color:{argb:BLACK}},right:{style:'thin',color:{argb:BLACK}},bottom:{style:'thin',color:{argb:BLACK}}};
const FONT={name:'Calibri',size:11,color:{argb:BLACK}};

function applyCurveLayout(wb){
  const ws=wb.getWorksheet?.('CURVA');
  if(!ws)return;

  // Layout oficial: Curvas_S_Unificadas_Arcelor
  ws.getColumn(1).width=18;
  ws.getColumn(2).width=14;
  const lastCol=Math.max(3,ws.columnCount||3);
  for(let c=3;c<=lastCol;c++)ws.getColumn(c).width=12;

  DISCIPLINES.forEach((label,i)=>{
    const r=1+i*7;
    try{if(!ws.getCell(r,1).isMerged)ws.mergeCells(r,1,r+5,1)}catch{}
    ws.getCell(r,1).value=label;

    for(let rr=r;rr<=r+5;rr++){
      ws.getRow(rr).height=20;
      const a=ws.getCell(rr,1);
      a.font={...FONT};
      a.alignment={horizontal:'center',vertical:'middle'};
      a.border=BORDER;
    }

    ['Data','Semana','Dia','Previsto','Replan','Realizado'].forEach((txt,k)=>{
      const b=ws.getCell(r+k,2);
      b.value=txt;
      b.font={name:'Calibri',size:11,bold:true,color:{argb:WHITE}};
      b.fill={type:'pattern',pattern:'solid',fgColor:{argb:BLUE}};
      b.alignment={horizontal:'left',vertical:'middle'};
      b.border=BORDER;
    });

    for(let c=3;c<=lastCol;c++){
      for(let k=0;k<6;k++){
        const cell=ws.getCell(r+k,c);
        cell.font={...FONT};
        cell.fill={type:'pattern',pattern:'none'};
        cell.alignment={horizontal:'center',vertical:'middle'};
        cell.border=BORDER;
      }
      ws.getCell(r,c).numFmt='dd/mm/yyyy';
      ws.getCell(r+3,c).numFmt='0.000000%';
      ws.getCell(r+4,c).numFmt='0.000000%';
      ws.getCell(r+5,c).numFmt='0.000000%';
    }
  });

  // O template original não usa congelamento de painéis.
  ws.views=[];
}

function patch(lib){
  if(!lib?.Workbook||lib.__LPS_CURVE_LAYOUT_LOCK__)return;
  const RealWorkbook=lib.Workbook;
  function LockedWorkbook(...args){
    const wb=new RealWorkbook(...args);
    if(wb?.xlsx?.writeBuffer){
      const original=wb.xlsx.writeBuffer.bind(wb.xlsx);
      wb.xlsx.writeBuffer=async(...a)=>{applyCurveLayout(wb);return original(...a)};
    }
    return wb;
  }
  LockedWorkbook.prototype=RealWorkbook.prototype;
  try{Object.setPrototypeOf(LockedWorkbook,RealWorkbook)}catch{}
  lib.Workbook=LockedWorkbook;
  lib.__LPS_CURVE_LAYOUT_LOCK__=true;
}

if(window.ExcelJS){
  patch(window.ExcelJS);
}else{
  let value;
  try{
    Object.defineProperty(window,'ExcelJS',{
      configurable:true,
      enumerable:true,
      get(){return value},
      set(v){
        value=v;
        patch(v);
        try{Object.defineProperty(window,'ExcelJS',{configurable:true,enumerable:true,writable:true,value:v})}catch{}
      }
    });
  }catch{}
}
})();