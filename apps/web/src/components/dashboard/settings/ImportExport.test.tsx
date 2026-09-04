import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportExport } from './ImportExport';
import { useStore } from '@/hooks/useStore';
import * as offlineDb from '@repo/offline-db';

// Mock the store hook
vi.mock('@/hooks/useStore', () => ({
  useStore: vi.fn(),
}));

// Mock the offline-db functions
vi.mock('@repo/offline-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/offline-db')>();
  return {
    ...actual,
    exportDataToJson: vi.fn(),
    exportDataToCsv: vi.fn(),
    validateAndImportData: vi.fn(),
  };
});

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test');
global.URL.revokeObjectURL = vi.fn();

describe('ImportExport Component', () => {
  const mockDb = {}; // Dummy db object

  beforeEach(() => {
    vi.clearAllMocks();
    (useStore as import('vitest').Mock).mockReturnValue({ db: mockDb });
  });

  it('renders export buttons and import dropzone', () => {
    render(<ImportExport />);
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Drop a file or click to browse')).toBeInTheDocument();
  });

  it('triggers JSON export when clicking Export JSON', async () => {
    const mockExportDataToJson = offlineDb.exportDataToJson as import('vitest').Mock;
    mockExportDataToJson.mockResolvedValue({ format: 1, decks: [] });

    render(<ImportExport />);
    const jsonBtn = screen.getByText('Export JSON');
    fireEvent.click(jsonBtn);

    await waitFor(() => {
      expect(mockExportDataToJson).toHaveBeenCalledWith(mockDb);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('handles validation and previews the import report', async () => {
    const mockValidateAndImportData = offlineDb.validateAndImportData as import('vitest').Mock;
    mockValidateAndImportData.mockResolvedValue({
      success: true,
      dry_run: true,
      counts: { decks: 2, notes: 10, cards: 15, review_events: 5 },
      errors: [],
    });

    render(<ImportExport />);
    
    // Create a dummy file
    const file = new File(['{"format": 1}'], 'test.json', { type: 'application/json' });
    const input = document.getElementById('import-file-input') as HTMLInputElement;
    
    // Simulate file selection
    fireEvent.change(input, { target: { files: [file] } });

    // Should show validation spinner, then the preview counts
    await waitFor(() => {
      expect(mockValidateAndImportData).toHaveBeenCalledWith(mockDb, '{"format": 1}', { format: 'json', dryRun: true });
    });

    // Verify preview renders the counts
    expect(await screen.findByText('15')).toBeInTheDocument(); // cards count
    expect(screen.getByText('Import')).toBeInTheDocument(); // The final import button
  });

  it('shows error if file is unsupported', async () => {
    render(<ImportExport />);
    const file = new File(['some text'], 'test.txt', { type: 'text/plain' });
    const input = document.getElementById('import-file-input') as HTMLInputElement;
    
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Unsupported file format/i)).toBeInTheDocument();
  });
});
