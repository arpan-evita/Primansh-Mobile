import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
}

interface InvoiceData {
  invoice_number: string;
  issued_date: string;
  due_date?: string;
  client_name: string;
  client_email?: string;
  client_address?: string;
  client_phone?: string;
  contact_person?: string;
  subtotal: number;
  tax_rate: number;
  amount: number;
  items: InvoiceItem[];
  notes?: string;
}

/**
 * numberToWords
 * Simple utility to convert numbers to words (Mainly for INR context)
 */
const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numStr = Math.trunc(num).toString();
  if (numStr.length > 9) return 'Overflow';
  const n = (`000000000${numStr}`).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  let str = '';
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only ' : 'Only ';
  return str;
};

/**
 * generateInvoicePDF
 * Generates a premium, branded PDF matching the provided screenshot exactly.
 */
export const generateInvoicePDF = async (invoice: InvoiceData) => {
  const doc = new jsPDF() as any;
  const margin = 10;
  const pageWidth = doc.internal.pageSize.width;
  
  // Custom Colors from Screenshot
  const primanshBlue = [59, 130, 246]; // Brand Blue
  const primaryTeal = [79, 209, 197]; // #4FD1C5
  const lightBeige = [254, 243, 199]; // #FEF3C7
  const darkGray = [30, 41, 59];
  const mutedGray = [100, 116, 139];

  // Helper: Get QR Code
  const getQRCode = async (data: string): Promise<string> => {
    try {
      const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data)}`);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) { return ""; }
  };

  // 1. Header
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.setTextColor(59, 89, 152); // Darker Blue
  doc.text("Primansh", margin, 20);
  
  // Gradient Logo Placeholder (Stylized P)
  doc.setFillColor(79, 209, 197);
  doc.setDrawColor(59, 130, 246);
  // Drawing a simple stylized P with shapes
  doc.roundedRect(pageWidth - margin - 15, 10, 15, 20, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("P", pageWidth - margin - 10, 24);

  // Metadata
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Document No:", margin, 32);
  doc.text("Date of Invoice:", margin, 38);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.invoice_number, margin + 40, 32);
  doc.text(new Date(invoice.issued_date).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), margin + 40, 38);

  // 2. CONSIGNEE Box
  doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.rect(margin, 45, pageWidth - (margin * 2), 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CONSIGNEE", margin + 2, 49.5);

  doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.rect(margin, 51, pageWidth - (margin * 2), 22);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  // Column 1
  doc.text("Company:", margin + 2, 57);
  doc.text("Address:", margin + 2, 63);
  doc.text("Phone:", margin + 2, 77);
  doc.text("Contacted Person:", margin + 2, 82);
  
  doc.setFont("helvetica", "bold");
  doc.text(invoice.client_name || "Gupta Varundeep & Co.", margin + 30, 57);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(invoice.client_address || "Office no. H312, Sushant Shopping Arcade, Sushant Lok-1, Gurgaon\n122009", margin + 30, 63, { maxWidth: 80 });
  doc.setFontSize(8);
  doc.text(invoice.client_phone || "+91 97173 55517", margin + 30, 77);
  doc.text(invoice.contact_person || "Varun Gupta", margin + 30, 82);

  // Column 2 (Email)
  doc.setFont("helvetica", "bold");
  doc.text("E-mail:", pageWidth / 2 + 10, 77);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(invoice.client_email || "varun@gvcaudit.com", pageWidth / 2 + 35, 77);

  // 3. REMARKS Box
  let currentY = 87;
  doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.rect(margin, currentY, pageWidth - (margin * 2), 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("REMARKS", margin + 2, currentY + 4.5);

  doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.rect(margin, currentY + 6, pageWidth - (margin * 2), 15);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text("Payment:", margin + 10, currentY + 13);
  doc.text("Payment Terms:", margin + 10, currentY + 18);
  doc.setFont("helvetica", "bold");
  doc.text("Net Banking", margin + 40, currentY + 13);
  doc.text("One Time Payment", margin + 40, currentY + 18);

  // 4. Items Table
  currentY += 25;
  const safeItems = Array.isArray(invoice.items) ? invoice.items : [];
  const tableRows = safeItems.map((item: any, index: number) => [
    (index + 1).toString(),
    item.description || "SEO Growth Pro",
    item.quantity.toString(),
    "Nos",
    Number(item.rate).toFixed(0),
    Number(item.quantity * item.rate).toFixed(0),
    "INR"
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["Serial no", "DESCRIPTION", "QTY", "UNIT", "UNIT PRICE", "NET PRICE", ""]],
    body: tableRows,
    theme: "grid",
    headStyles: { 
      fillColor: primaryTeal as any, 
      textColor: [255, 255, 255], 
      fontSize: 7, 
      fontStyle: "bold", 
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    bodyStyles: { 
      fontSize: 10, 
      fontStyle: "bold",
      textColor: [0, 0, 0], 
      halign: "center",
      minCellHeight: 20,
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 'auto', halign: "center" },
      2: { cellWidth: 15 },
      3: { cellWidth: 15 },
      4: { cellWidth: 15 },
      5: { cellWidth: 10, halign: "right" },
      6: { cellWidth: 10, halign: "left" }
    }
  });

  currentY = (doc as any).lastAutoTable?.finalY;

  // Yellow Spacer
  doc.setFillColor(lightBeige[0], lightBeige[1], lightBeige[2]);
  doc.rect(margin, currentY, pageWidth - (margin * 2), 10, "F");
  currentY += 15;

  // 5. Referral Benefit & Services
  doc.setTextColor(34, 197, 94); // Green
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Referral Benefit", margin, currentY);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Refer someone who needs website design, SEO, or ongoing website management—and receive exclusive benefits or discounts on your next service with us.", margin, currentY + 5, { maxWidth: pageWidth - (margin * 2) });
  
  currentY += 15;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(59, 89, 152);
  doc.text("Our Services", margin, currentY);
  const services = [
    { title: "1. Website Design & Redesign", desc: "High-converting, modern websites built for performance and scalability." },
    { title: "2. Monthly SEO & Ranking Support", desc: "Ongoing SEO to improve visibility, compete with rivals, and rank consistently over time." },
    { title: "3. Website Management & Maintenance", desc: "Regular updates, performance monitoring, fixes, and security—so your site stays fast and reliable." },
    { title: "4. Content Creation & Monthly Content Management", desc: "SEO-friendly content updates that keep your website relevant, active, and conversion-focused." },
    { title: "5. Process Automation (Excel / VBA)", desc: "Custom automation solutions to streamline internal workflows and reduce manual work." }
  ];
  
  services.forEach((s, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(s.title, margin, currentY + 5 + (i * 8));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor( darkGray[0], darkGray[1], darkGray[2]);
    doc.text(s.desc, margin, currentY + 8 + (i * 8));
  });

  currentY += 50;

  // 6. Terms & Conditions
  doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.rect(margin, currentY, pageWidth - (margin * 2), 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions", pageWidth / 2, currentY + 4, { align: "center" });
  
  const terms = [
    ["1. Payment Terms: Payment is due within 5 days from the invoice date. Late payments are subject to a 5% late fee."],
    ["2. Project Changes: Any additional work not specified in the project discussion will be billed separately."],
    ["3. Refund Policy: We do not offer refunds. If you are unsatisfied with our services, please get in touch with us to discuss how we can address your concerns."],
    ["4. Confidentiality: We respect the confidentiality of your project. All information shared will be kept secure and used only for project purposes."]
  ];

  autoTable(doc, {
    startY: currentY + 6,
    margin: { left: margin, right: margin },
    body: terms,
    theme: "plain",
    styles: { 
      fontSize: 7.5, 
      cellPadding: 1.5, 
      textColor: [0, 0, 0],
      fillColor: [232, 248, 247] 
    },
    columnStyles: { 0: { cellWidth: pageWidth - (margin * 2) } }
  });

  currentY = (doc as any).lastAutoTable?.finalY + 8;

  // 7. Footer - Payment Details & Totals
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text(`Submition Date:   ${new Date().toLocaleDateString("en-US")} 07:47 PM`, margin, currentY);
  
  currentY += 4;
  const footerBoxHeight = 28;
  const paymentLabelWidth = 35;
  const paymentInfoWidth = 85;
  const totalsWidth = pageWidth - (margin * 2) - paymentLabelWidth - paymentInfoWidth - 5; // Remaining width

  // Payment Label Box (Dark Teal)
  doc.setFillColor(0, 96, 115);
  doc.rect(margin, currentY, paymentLabelWidth, footerBoxHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Details", margin + 2, currentY + footerBoxHeight / 2, { maxWidth: paymentLabelWidth - 4 });
  
  // Payment Info Box (White with Bank Details)
  doc.setDrawColor(0, 0, 0);
  doc.rect(margin + paymentLabelWidth, currentY, paymentInfoWidth, footerBoxHeight);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  const bankX = margin + paymentLabelWidth + 4;
  doc.text("Name - Divyansh Kumar", bankX, currentY + 7);
  doc.text("A/c - 309027846962", bankX, currentY + 13);
  doc.text("IFC code - RATN0000475", bankX, currentY + 19);
  doc.text("UPI - 6202490512-2@ybl", bankX, currentY + 25);

  // QR Code (Far right of info box)
  const qrBase64 = await getQRCode(`upi://pay?pa=6202490512-2@ybl&pn=Divyansh%20Kumar&am=${invoice.amount}&cu=INR`);
  if (qrBase64) {
    doc.addImage(qrBase64, "PNG", margin + paymentLabelWidth + paymentInfoWidth - 25, currentY + 3, 22, 22);
  }

  // Totals Box (Right Side)
  const totalsX = margin + paymentLabelWidth + paymentInfoWidth + 5;
  autoTable(doc, {
    startY: currentY,
    margin: { left: totalsX, right: margin },
    body: [
      ["SUBTOTAL:", `${Number(invoice.subtotal).toFixed(2)} INR`],
      ...(invoice.tax_rate > 0 ? [
        [`TAX (${invoice.tax_rate}%):`, `${(Number(invoice.subtotal) * (Number(invoice.tax_rate) / 100)).toFixed(2)} INR`]
      ] : []),
      ["Total", `${Number(invoice.amount).toFixed(2)} INR`]
    ],
    theme: "grid",
    styles: { 
      fontSize: 8, 
      halign: "right", 
      cellPadding: 1,
      lineColor: [79, 209, 197],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { 
        fillColor: [232, 248, 247], 
        textColor: [59, 89, 152], 
        fontStyle: "bold", 
        halign: "left",
        cellWidth: 25
      },
      1: { 
        textColor: [59, 89, 152], 
        fontStyle: "bold", 
        halign: "right",
        cellWidth: totalsWidth - 25
      }
    }
  });

  doc.setTextColor( mutedGray[0], mutedGray[1], mutedGray[2] );
  doc.setFontSize(7);
  doc.text(`Ruppe ${numberToWords(invoice.amount)}`, totalsX, currentY + footerBoxHeight + 4);

  // Signature
  currentY += 42;
  doc.setTextColor( mutedGray[0], mutedGray[1], mutedGray[2] );
  doc.setFontSize(8);
  doc.text("Signature:", margin, currentY);
  doc.setFont("times", "italic");
  doc.setFontSize(26);
  doc.setTextColor(0, 0, 0);
  doc.text("Divyansh Kumar", margin + 30, currentY);

  // Bottom Footer Bar
  currentY += 12;
  doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.rect(margin, currentY, pageWidth - (margin * 2), 6, "F");
  doc.setTextColor(59, 89, 152);
  doc.setFontSize(6.5);
  doc.text("Tel: +91 6202490512   |   Whatsapp 6202490512   |   support@primansh.com   |   divyansh@primansh.com   |   Primansh.com   |", pageWidth / 2, currentY + 11, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
  doc.text("We genuinely enjoyed working with you on this project and hope this is just the beginning of a long-term partnership.", pageWidth / 2, currentY + 20, { align: "center" });

  doc.save(`Invoice_${invoice.invoice_number}.pdf`);
};
