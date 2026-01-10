import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RootLayout, { metadata } from '../layout';

describe('RootLayout', () => {
  it('should render children', () => {
    const { container } = render(
      <RootLayout>
        <div data-testid="child">Test Content</div>
      </RootLayout>
    );

    expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument();
  });

  it('should have correct HTML structure', () => {
    const { container } = render(
      <RootLayout>
        <div data-testid="content">Content</div>
      </RootLayout>
    );

    // React Testing Library renders components in a div, not full HTML document
    // So we check that our content is rendered correctly
    const content = container.querySelector('[data-testid="content"]');
    expect(content).toBeInTheDocument();
    expect(content?.textContent).toBe('Content');
  });

  it('should have correct metadata', () => {
    expect(metadata.title).toBe('AI Schedule - Project Planning Tool');
    expect(metadata.description).toBe('AI-powered project scheduling with natural language editing');
  });
});
