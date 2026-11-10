import type { WorkSessionSummaryRow } from '@/shared/types/models';
import { calculateCompletedRounds } from '@/shared/lib/formatters';

function escapeCsvField(field: string | number): string {
  let str = String(field);
  if (/^[=+\-@]/.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}

export function exportReportsToCsv(rows: WorkSessionSummaryRow[], filename = 'rokad-report.csv'): void {
  const headers = ['نام کاربر', 'نوع', 'پروژه / تسک', 'تعداد دور', 'مجموع زمان (دقیقه)'];
  const csvLines = [headers.map(escapeCsvField).join(',')];

  for (const r of rows) {
    const kindLabel = r.task ? 'تسک اسکرام' : r.project ? 'پروژه' : '-';
    const targetLabel = r.task
      ? r.task.scrum
        ? `[${r.task.scrum.name}] ${r.task.name}`
        : r.task.name
      : r.project?.name || '-';
    const line = [
      escapeCsvField(r.user?.name || '-'),
      escapeCsvField(kindLabel),
      escapeCsvField(targetLabel),
      escapeCsvField(calculateCompletedRounds(r.totalSeconds)),
      escapeCsvField(Math.round(r.totalSeconds / 60)),
    ].join(',');
    csvLines.push(line);
  }

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

