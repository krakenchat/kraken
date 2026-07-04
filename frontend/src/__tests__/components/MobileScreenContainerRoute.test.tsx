import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test-utils';
import { MobileScreenContainer } from '../../components/Mobile/Screens/MobileScreenContainer';
import { MobileNavigationProvider } from '../../components/Mobile/Navigation/MobileNavigationContext';

describe('MobileScreenContainer — route screen', () => {
  it('renders the matched router Outlet content for a non-screen route', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <MobileNavigationProvider>
              <MobileScreenContainer />
            </MobileNavigationProvider>
          }
        >
          <Route path="community/create" element={<div>CREATE COMMUNITY OUTLET</div>} />
        </Route>
      </Routes>,
      { routerProps: { initialEntries: ['/community/create'] } },
    );

    expect(await screen.findByText('CREATE COMMUNITY OUTLET')).toBeInTheDocument();
    // Back button from the route app bar is present
    expect(screen.getByLabelText('Go back')).toBeInTheDocument();
  });
});
