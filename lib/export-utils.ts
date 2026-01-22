import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type ExportColumn = {
  header: string
  accessor: string | ((row: any) => string | number | null | undefined)
}

/**
 * Exports data to CSV
 */
export function exportToCsv(data: any[], columns: ExportColumn[], filename: string) {
  if (!data || !data.length) {
    alert('No data to export')
    return
  }

  // Build header row
  const headers = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',')
  
  // Build rows
  const rows = data.map(row => {
    return columns.map(c => {
      let val: any
      if (typeof c.accessor === 'function') {
        val = c.accessor(row)
      } else {
        val = row[c.accessor]
      }
      
      if (val === null || val === undefined) val = ''
      const str = String(val)
      return `"${str.replace(/"/g, '""')}"`
    }).join(',')
  })

  const csvContent = [headers, ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  
  // Use a simple anchor tag download if file-saver is not desired, 
  // but standard browser API is fine.
  const link = document.createElement('a')
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

/**
 * Exports data to PDF
 */
export function exportToPdf(data: any[], columns: ExportColumn[], title: string, filename: string, subtitle?: string) {
  if (!data || !data.length) {
    alert('No data to export')
    return
  }

  const doc = new jsPDF()

  // Title
  doc.setFontSize(18)
  doc.setTextColor(40, 40, 40)
  doc.text(title, 14, 22)

  // Subtitle / Date
  if (subtitle) {
    doc.setFontSize(11)
    doc.setTextColor(100, 100, 100)
    doc.text(subtitle, 14, 30)
  }

  // Prepare table data
  const head = [columns.map(c => c.header)]
  const body = data.map(row => {
    return columns.map(c => {
      let val: any
      if (typeof c.accessor === 'function') {
        val = c.accessor(row)
      } else {
        val = row[c.accessor]
      }
      return val === null || val === undefined ? '' : String(val)
    })
  })

  // Generate table
  autoTable(doc, {
    head: head,
    body: body,
    startY: subtitle ? 35 : 25,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      // Let's stick to a clean look: Dark background, white text.
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    }
  })

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
