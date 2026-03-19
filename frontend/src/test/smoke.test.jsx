import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Simple dummy component for testing the setup
const TestComponent = () => <h1>SPARK Test</h1>;

describe('Vitest Setup', () => {
  it('should render the test component', () => {
    render(<TestComponent />);
    expect(screen.getByText('SPARK Test')).toBeDefined();
  });
});
