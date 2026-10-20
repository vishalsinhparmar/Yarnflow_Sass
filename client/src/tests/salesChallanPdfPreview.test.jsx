import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import PdfPreviewModal from '../components/SalesChallan/PdfPreviewModal';

const defaultProps = {
  isOpen: true,
  url: 'blob:challan-preview',
  title: 'Delivery challan',
  reference: 'PKRK/SC/008',
  description: 'Individual challan document',
  onClose: vi.fn(),
  onDownload: vi.fn()
};

describe('Sales challan PDF preview', () => {
  it('keeps the preview inside the responsive ERP workspace', () => {
    render(<PdfPreviewModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog', { name: 'Delivery challan' });
    expect(dialog.parentElement).toHaveClass(
      'top-16',
      'lg:left-[var(--sidebar-width)]'
    );
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Individual challan document • PKRK/SC/008')).toBeInTheDocument();
    expect(screen.getByTitle('Delivery challan preview')).toHaveAttribute(
      'src',
      'blob:challan-preview'
    );
  });

  it('retains download and keyboard close behavior', () => {
    const onClose = vi.fn();
    const onDownload = vi.fn();

    render(
      <PdfPreviewModal
        {...defaultProps}
        onClose={onClose}
        onDownload={onDownload}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledOnce();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
