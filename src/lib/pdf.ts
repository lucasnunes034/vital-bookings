// Client-only PDF export: renders a DOM node to a multi-page A4 PDF and forces download.
// Uses html2canvas-pro (supports oklch colors from Tailwind v4) + jsPDF, loaded lazily.
export async function downloadElementAsPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale: Math.max(2, Math.min(3, window.devicePixelRatio || 2)), // sharp text on mobile
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: 900, // render desktop layout regardless of device width
    onclone: (doc) => {
      doc.documentElement.classList.remove("dark");
      doc.querySelectorAll("[data-pdf-ignore]").forEach((n) => n.remove());
    },
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 10;
  const pageW = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageH = pdf.internal.pageSize.getHeight() - margin * 2;
  const pxPerMm = canvas.width / pageW;
  const pagePx = Math.floor(pageH * pxPerMm);

  let offset = 0;
  let first = true;
  while (offset < canvas.height) {
    const sliceH = Math.min(pagePx, canvas.height - offset);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, pageW, sliceH / pxPerMm);
    first = false;
    offset += sliceH;
  }
  pdf.save(filename);
}
