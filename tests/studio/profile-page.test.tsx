import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import ProfileStudioPage from '@/features/studio/profile/ProfileStudioPage';

describe('ProfileStudioPage', () => {
  it('renders the identity form, upload zone and privacy notice', async () => {
    render(createElement(MemoryRouter, null, createElement(ProfileStudioPage)));
    await waitFor(() => expect(screen.getByRole('button', { name: /upload profile picture/i })).toBeTruthy());
    expect(screen.getByLabelText('Full name')).toBeTruthy();
    expect(screen.getAllByText(/your images stay on this device/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /delete all local data/i })).toBeTruthy();
  });
});
