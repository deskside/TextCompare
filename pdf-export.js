/* Fixed print geometry keeps PDF wrapping independent of the on-screen viewport. */
const PDF_LINES_PER_PAGE = 26;
const PDF_STYLE = `
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}html,body{margin:0;background:white;color:#20332f;font-family:"Microsoft YaHei","微软雅黑",sans-serif}
.pdf-page{width:297mm;height:210mm;padding:12mm;position:relative;break-after:page;page-break-after:always;overflow:hidden}
.pdf-page:last-child{break-after:auto;page-break-after:auto}
.pdf-columns{display:grid;grid-template-columns:1fr 1fr;gap:10mm}
.pdf-column{min-width:0}h2{font-size:14pt;line-height:8mm;margin:0 0 5mm;border-bottom:1px solid #d4dcd0;padding-bottom:2mm}
.pdf-line,.pdf-measure{font-size:10pt;line-height:6mm;font-family:"Microsoft YaHei","微软雅黑",sans-serif;color:black;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4}
.pdf-line{height:6mm}.pdf-line.deleted{background:#faeef0}.pdf-line.added{background:#edf1f8}
.pdf-footer{position:absolute;bottom:8mm;left:12mm;right:12mm;text-align:center;font-size:9pt;color:#57675e}
.pdf-measure{width:131.5mm;position:absolute;left:0;top:0;visibility:hidden}.pdf-measure>div{min-height:6mm}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
`;
function pdfEscape(value) {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function pdfPaginate(oldLines,newLines) {
  const count=Math.max(1,Math.ceil(Math.max(oldLines.length,newLines.length)/PDF_LINES_PER_PAGE));
  return Array.from({length:count},(_,index)=>({old:oldLines.slice(index*PDF_LINES_PER_PAGE,(index+1)*PDF_LINES_PER_PAGE),new:newLines.slice(index*PDF_LINES_PER_PAGE,(index+1)*PDF_LINES_PER_PAGE),number:index+1,total:count}));
}
function pdfLineHtml(line,side) {
  const changed=line.some(part=>part.changed);
  return `<div class="pdf-line${changed?' '+side:''}">${line.map(part=>`<span style="color:${part.changed?(side==='deleted'?'#c32946':'#5883bf'):'#000000'}">${pdfEscape(part.text)}</span>`).join('')}</div>`;
}
function pdfPagesHtml(oldLines,newLines) {
  return pdfPaginate(oldLines,newLines).map(page=>`<article class="pdf-page"><div class="pdf-columns"><div class="pdf-column"><h2>旧版标注结果</h2>${page.old.map(line=>pdfLineHtml(line,'deleted')).join('')}</div><div class="pdf-column"><h2>新版标注结果</h2>${page.new.map(line=>pdfLineHtml(line,'added')).join('')}</div></div><footer class="pdf-footer">第 ${page.number} / ${page.total} 页</footer></article>`).join('');
}
function pdfMeasureLines(doc,source) {
  const measure=doc.createElement('div');measure.className='pdf-measure';
  let logical=doc.createElement('div');measure.append(logical);
  // Only recreate text and diff colors, never copy page backgrounds or controls.
  for(const span of source.children){const changed=span.style.color!=='rgb(0, 0, 0)'&&span.style.color!=='#000000';const parts=span.textContent.split('\n');parts.forEach((part,index)=>{if(index){logical=doc.createElement('div');measure.append(logical);}if(part){const run=doc.createElement('span');run.textContent=part;run.dataset.changed=String(changed);logical.append(run);}});}
  doc.body.append(measure);
  const result=[];
  for(const block of measure.children){const height=parseFloat(doc.defaultView.getComputedStyle(block).lineHeight),top=block.getBoundingClientRect().top,rows=Array.from({length:Math.max(1,Math.round(block.getBoundingClientRect().height/height))},()=>[]);for(const run of block.children){const node=run.firstChild,range=doc.createRange();let offset=0;for(const char of node.textContent){range.setStart(node,offset);offset+=char.length;range.setEnd(node,offset);const rect=range.getBoundingClientRect(),row=Math.max(0,Math.min(rows.length-1,Math.round((rect.top-top)/height))),parts=rows[row],changed=run.dataset.changed==='true',last=parts[parts.length-1];if(last&&last.changed===changed)last.text+=char;else parts.push({text:char,changed});}}result.push(...rows);}
  measure.remove();return result;
}
let pdfExportBusy=false;
async function exportResultsPdf() {
  if(pdfExportBusy||el('exportPdf').disabled)return;
  pdfExportBusy=true;
  const buttons=['exportPdf','exportPdfBottom'];buttons.forEach(id=>el(id).disabled=true);
  const oldHtml=el('oldResult').innerHTML,newHtml=el('newResult').innerHTML;
  const frame=document.createElement('iframe');frame.title='PDF 导出排版';frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-10000px;top:0;width:1123px;height:794px;border:0;';
  document.body.append(frame);
  try {
    const doc=frame.contentDocument;
    doc.open();doc.write(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>手册文字对比结果</title><style>${PDF_STYLE}</style><body></body></html>`);doc.close();
    if(doc.fonts)await doc.fonts.ready;
    // Snapshot the results before waiting, so subsequent input cannot change this export.
    const oldSource=doc.createElement('div'),newSource=doc.createElement('div');oldSource.innerHTML=oldHtml;newSource.innerHTML=newHtml;
    const oldLines=pdfMeasureLines(doc,oldSource),newLines=pdfMeasureLines(doc,newSource);
    doc.body.innerHTML=pdfPagesHtml(oldLines,newLines);
    await new Promise(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(resolve)));
    frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});
    el('copyFeedback').textContent='';
    frame.contentWindow.focus();frame.contentWindow.print();
  } catch(error) {
    frame.remove();el('copyFeedback').textContent='PDF 导出未成功，请重试。';console.error(error);
  } finally {
    pdfExportBusy=false;
    const stale=el('copyOld').disabled;buttons.forEach(id=>el(id).disabled=stale);
    // Some browsers do not emit afterprint when the dialog is cancelled.
    window.setTimeout(()=>frame.remove(),120000);
  }
}
