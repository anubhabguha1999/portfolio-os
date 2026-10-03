import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AssistantPage from '@/features/assistant/AssistantPage';

describe('AssistantPage', () => {
  it('renders settings, the privacy notice and inactive tools without a key', async () => {
    render(
      <MemoryRouter initialEntries={['/assistant']}>
        <AssistantPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('API key')).toHaveProperty('type', 'password');
    expect(screen.getByRole('switch', { name: 'Remember on this device' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/goes from your browser straight to Anthropic/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Suggest rewrites/ })).toHaveProperty('disabled', true);
    await waitFor(() => expect(screen.getByLabelText('Model')).toHaveProperty('value', 'claude-opus-5-5'));
  });
});
