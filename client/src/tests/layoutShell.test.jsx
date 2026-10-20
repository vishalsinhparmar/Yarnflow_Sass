import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import SideBarApp from '../components/SideBarApp/SideBarApp';
import AppInitializationLoader from '../components/common/AppInitializationLoader';
import Modal from '../components/model/Modal';
import Layout from '../layout/Layout';

vi.mock('../components/NavbarApp/NavbarApp', () => ({ default: () => <div>Header</div> }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ canVisit: () => true }) }));

const renderSidebar = (props = {}) => render(
  <MemoryRouter initialEntries={['/app/purchase-order']}>
    <SideBarApp {...props} />
  </MemoryRouter>
);

describe('ERP layout shell', () => {
  it('defines one shared workspace boundary below the header and beside the sidebar', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    const main = container.querySelector('[data-erp-main]');
    expect(main).toHaveClass('top-[var(--header-height)]', 'lg:left-[var(--sidebar-width)]');
  });

  it('provides an accessible desktop collapse control', () => {
    const onToggle = vi.fn();
    renderSidebar({ onToggle });

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.getByText('Purchase Order (PO)')).toBeInTheDocument();
  });

  it('renders the compact sidebar as an icon rail with named links', () => {
    renderSidebar({ collapsed: true });

    expect(screen.queryByText('Purchase Order (PO)')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Purchase Order (PO)' })).toHaveAttribute(
      'title',
      'Purchase Order (PO)'
    );
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('positions drawer forms from the shared sidebar width', () => {
    const { container } = render(
      <Modal isOpen onClose={vi.fn()} title="Create document" size="drawer">
        <div>Drawer content</div>
      </Modal>
    );

    expect(container.firstChild).toHaveClass('lg:left-[var(--sidebar-width)]');
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
  });

  it('keeps standard modal headers visible while the body scrolls', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Edit Customer" size="6xl">
        <div>Customer form content</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog', { name: 'Edit Customer' });
    const body = screen.getByText('Customer form content').parentElement;

    expect(dialog).toHaveClass('max-h-[calc(100vh-5rem)]', 'max-w-6xl', 'overflow-hidden');
    expect(body).toHaveClass('min-h-0', 'overflow-y-auto');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('renders a branded, accessible application initialization state', () => {
    render(<AppInitializationLoader />);

    expect(screen.getByRole('main', { name: 'Initializing YarnFlow' })).toBeInTheDocument();
    expect(screen.getByText('Preparing your workspace')).toBeInTheDocument();
    expect(screen.getByText('YarnFlow')).toBeInTheDocument();
  });
});
