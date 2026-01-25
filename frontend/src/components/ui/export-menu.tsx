'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

type ExportFormat = 'excel' | 'pdf' | 'csv';

interface ExportMenuProps {
  onExport: (format: ExportFormat) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/**
 * Export menu component with format selection
 */
export function ExportMenu({
  onExport,
  disabled = false,
  label = 'Exporter',
  className,
}: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('excel');

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(format);
    } finally {
      setIsExporting(false);
    }
  };

  const formatIcons: Record<ExportFormat, React.ReactNode> = {
    excel: <FileSpreadsheet className="h-4 w-4" />,
    pdf: <FileText className="h-4 w-4" />,
    csv: <FileSpreadsheet className="h-4 w-4" />,
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="excel">
            <div className="flex items-center">
              <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
              Excel
            </div>
          </SelectItem>
          <SelectItem value="pdf">
            <div className="flex items-center">
              <FileText className="mr-2 h-4 w-4 text-red-600" />
              PDF
            </div>
          </SelectItem>
          <SelectItem value="csv">
            <div className="flex items-center">
              <FileSpreadsheet className="mr-2 h-4 w-4 text-blue-600" />
              CSV
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        onClick={handleExport}
        disabled={disabled || isExporting}
        variant="outline"
        className="press-effect"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Export...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Simple export button (single format)
 */
export function ExportButton({
  onClick,
  format = 'excel',
  disabled = false,
  label,
  className,
}: {
  onClick: () => void | Promise<void>;
  format?: ExportFormat;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = async () => {
    setIsExporting(true);
    try {
      await onClick();
    } finally {
      setIsExporting(false);
    }
  };

  const formatLabels: Record<ExportFormat, string> = {
    excel: 'Excel',
    pdf: 'PDF',
    csv: 'CSV',
  };

  const formatIcons: Record<ExportFormat, React.ReactNode> = {
    excel: <FileSpreadsheet className="mr-2 h-4 w-4" />,
    pdf: <FileText className="mr-2 h-4 w-4" />,
    csv: <FileSpreadsheet className="mr-2 h-4 w-4" />,
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isExporting}
      variant="outline"
      className={`press-effect ${className}`}
    >
      {isExporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Export...
        </>
      ) : (
        <>
          {formatIcons[format]}
          {label || `Export ${formatLabels[format]}`}
        </>
      )}
    </Button>
  );
}
