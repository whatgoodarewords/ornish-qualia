// Reveal guides follow the original alpha outline; the artwork itself is unchanged.
(() => {
  const guides = [{"d":"M207,409L214,366L229,328L239,311L256,289L281,266L316,245L356,231L378,227L405,225L454,229L483,237L509,249L525,259L546,276L563,295L574,311L587,336L594,359L599,364L603,361L603,354L608,345L621,337L657,337L663,339L671,346L674,354L674,483L676,504L680,519L685,528L693,537L705,544L722,548L734,548L755,543L771,533L783,515L789,489L789,353L792,347L799,340L805,337L846,337L856,342L863,353L863,384L866,386L872,382L880,370L893,358L908,348L926,340L962,332L1007,331L1043,336L1069,345L1094,362L1110,382L1118,403L1121,422L1121,530L1123,542L1128,554L1135,557","length":1695.93},{"d":"M207,409L207,442L209,461L213,482L221,506L234,531L248,550L261,564L285,582L305,592L327,600L352,606L377,609L429,607L461,600L486,591L500,584L502,582L500,577L474,554L453,539L443,538L443,540L440,541L419,545L379,544L350,536L334,528L323,520L305,501L291,477L285,458L281,433L281,410L284,389L292,364L300,349L312,333L336,312L360,299L376,294L396,291L421,291L435,293L453,298L466,304L483,315L499,330L510,345L518,360L528,394L529,437L520,472L501,505L494,504L467,491L446,487L421,488L409,493L405,497L402,502L402,512L404,515L416,523L426,525L441,532L444,538","length":1405.09},{"d":"M1491,577L1491,589L1494,595L1500,601L1511,605L1544,605L1550,603L1559,596L1563,585L1563,418L1556,390L1546,372L1534,359L1506,342L1478,334L1450,331L1402,333L1381,337L1350,350L1328,366L1313,385L1306,389L1304,387L1304,354L1301,346L1294,339L1288,336L1245,336L1239,339L1230,350L1229,586L1231,593L1237,600L1249,605L1288,604L1300,596L1304,586L1304,578L1307,578L1312,580L1331,595L1356,605L1376,609L1412,609L1430,606L1453,599L1468,592L1482,582L1490,580","length":1250.84},{"d":"M1048,575L1047,579L1049,580L1054,592L1063,600L1075,604L1110,604L1118,602L1125,598L1134,586L1137,577L1135,560L1136,240L1141,226L1151,218L1190,217L1197,218L1203,222L1208,228L1211,238L1211,583L1209,592L1202,601L1192,605L1181,605L1163,599L1149,587L1143,578L1137,576","length":998.13},{"d":"M764,641L759,646L750,649L707,657L666,657L629,651L601,643L567,628L536,608L508,585L508,579L527,568L549,548L551,548L568,563L595,581L638,601L648,602L647,596L627,579L611,553L604,523L602,474L600,472L595,474L588,493L574,519L551,548","length":688.18},{"d":"M1303,493L1305,483L1305,415L1312,417L1317,422L1331,429L1349,432L1359,428L1378,404L1396,393L1417,388L1442,387L1463,390L1476,396L1485,405L1489,415L1489,422L1487,428L1483,432L1474,435L1408,439L1363,448L1341,457L1322,469L1313,478L1305,480","length":502.26},{"d":"M864,417L885,428L899,432L906,432L916,428L923,421L932,407L943,398L959,391L987,387L1008,388L1028,393L1040,402L1046,415L1045,426L1038,433L1021,436L964,439L920,448L896,458L871,477L864,479","length":418.38},{"d":"M922,519L922,533L925,540L933,548L939,551L953,555L980,555L997,551L1021,540L1038,524L1045,506L1045,480L1003,480L960,487L935,500L926,510L922,519","length":330.77},{"d":"M1364,525L1365,535L1370,543L1384,552L1395,555L1424,555L1446,549L1468,537L1482,522L1488,505L1488,480L1463,479L1435,481L1400,488L1383,496L1370,508L1366,515L1364,525","length":331.46},{"d":"M789,581L789,591L792,597L798,603L808,607L845,607L851,605L860,597L864,581L863,569L862,565L855,562L851,554L847,533L848,518L852,503L855,498L860,495L863,496L862,565","length":276.31},{"d":"M1230,277L1231,290L1236,300L1248,311L1261,316L1276,316L1291,310L1303,296L1307,282L1306,271L1298,255L1287,246L1276,242L1260,242L1245,249L1234,262L1230,277","length":238.54},{"d":"M864,580L873,583L889,595L911,604L934,609L970,609L999,603L1013,598L1047,579","length":196.22},{"d":"M648,601L674,608L718,610L752,602L769,594L782,585L788,584","length":146.58},{"d":"M1290,519L1291,546L1296,559L1303,563L1304,498L1301,497L1296,500L1290,519","length":142.93},{"d":"M600,364L602,383L602,449L600,472","length":108.19},{"d":"M862,492L864,481L863,419L865,386","length":106.25},{"d":"M501,505L504,510L551,547","length":65.65}];
  const mark = document.querySelector('.mark'), image = mark?.querySelector('img');
  if (!image) return;
  const canvas = document.createElement('canvas'), mask = document.createElement('canvas');
  canvas.className = 'wordmark-trace'; canvas.setAttribute('aria-hidden', 'true');
  const ink = canvas.getContext('2d'), brush = mask.getContext('2d');
  if (!ink || !brush || typeof Path2D === 'undefined') return;
  const paths = guides.map(g => ({...g, path:new Path2D(g.d)}));
  const clamp = p => Math.min(1, Math.max(0, p));
  const smooth = p => {p=clamp(p);return p*p*(3-2*p);};
  let active=false, last=1, scale=1;
  const notify = () => document.dispatchEvent(new Event('qualia:wordmark-trace'));
  window.qualiaTrace = {
    get source(){return active ? canvas : null;},
    setProgress(progress){
      const p=clamp(progress);
      if(p===last)return;
      last=p;
      if(p>=1){
        if(active){active=false;mark.classList.remove('is-tracing');canvas.remove();notify();}
        return;
      }
      if(!image.complete||!image.naturalWidth)return;
      if(!active){
        canvas.width=mask.width=Math.min(image.naturalWidth,Math.ceil(image.getBoundingClientRect().width*(devicePixelRatio||1)));
        canvas.height=mask.height=Math.round(canvas.width*887/1774);scale=canvas.width/1774;
        mark.append(canvas);mark.classList.add('is-tracing');active=true;
      }
      brush.setTransform(1,0,0,1,0,0);brush.clearRect(0,0,mask.width,mask.height);
      brush.setTransform(scale,0,0,scale,0,0);
      brush.strokeStyle='#fff';brush.lineWidth=22;brush.lineCap='round';brush.lineJoin='round';
      for(let i=0;i<paths.length;i++){
        const guide=paths[i],delay=(i%5)*.012,local=clamp((p-delay)/(1-delay));
        if(local===0)continue;
        // A modest gather-and-release of speed, with no wobble or extra delay.
        const flow=local-.025*Math.sin(local*Math.PI*2);
        brush.lineWidth=22*smooth(local/.12);
        brush.setLineDash([guide.length,guide.length+24]);
        brush.lineDashOffset=guide.length*(1-flow);
        brush.stroke(guide.path);
      }
      // Settle antialiasing and tiny detached details into the exact original.
      brush.setLineDash([]);brush.globalAlpha=smooth((p-.80)/.20);
      brush.fillStyle='#fff';brush.fillRect(0,0,1774,887);brush.globalAlpha=1;
      ink.clearRect(0,0,canvas.width,canvas.height);
      ink.drawImage(image,0,0,canvas.width,canvas.height);
      ink.globalCompositeOperation='destination-in';ink.drawImage(mask,0,0);ink.globalCompositeOperation='source-over';
      notify();
    }
  };
})();
