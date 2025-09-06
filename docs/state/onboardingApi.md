# Onboarding Redux API Slice

> **Location:** `frontend/src/features/onboarding/onboardingApiSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** Instance setup and first-time configuration

## Overview

The Onboarding API slice manages the initial setup process for new Kraken instances. It handles checking if an instance needs setup and provides the setup process for creating the first admin user and configuring the instance. This API is unique as it doesn't require authentication for initial setup operations.

## API Configuration

```typescript
const baseQuery = fetchBaseQuery({
  baseUrl: '/api/onboarding',
  prepareHeaders: (headers) => {
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

export const onboardingApi = createApi({
  reducerPath: 'onboardingApi',
  baseQuery,
  tagTypes: ['OnboardingStatus'],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `onboardingApi`
- **Base Query:** Basic `fetchBaseQuery` (no authentication required for onboarding)
- **Base URL:** `/api/onboarding`
- **Tag Types:** `["OnboardingStatus"]`

## Endpoints

### Query Endpoints (Status Checking)

#### getOnboardingStatus
```typescript
getOnboardingStatus: builder.query<OnboardingStatus, void>({
  query: () => 'status',
  providesTags: ['OnboardingStatus'],
})
```

**Purpose:** Checks if the instance requires initial setup and provides setup token.

**Usage:**
```typescript
const { 
  data: onboardingStatus, 
  error, 
  isLoading,
  refetch 
} = useOnboardingApi.useGetOnboardingStatusQuery();

// Check if setup is needed
if (onboardingStatus?.needsSetup) {
  // Redirect to setup wizard
  navigate('/onboarding');
} else {
  // Instance is already configured
  navigate('/login');
}
```

### Mutation Endpoints (Setup Process)

#### setupInstance
```typescript
setupInstance: builder.mutation<SetupInstanceResponse, SetupInstanceRequest>({
  query: (setupData) => ({
    url: 'setup',
    method: 'POST',
    body: setupData,
  }),
  invalidatesTags: ['OnboardingStatus'],
})
```

**Purpose:** Performs initial instance setup including admin user creation and basic configuration.

**Usage:**
```typescript
const [setupInstance, { isLoading, error }] = useOnboardingApi.useSetupInstanceMutation();

const handleInstanceSetup = async (setupData: SetupInstanceRequest) => {
  try {
    const result = await setupInstance(setupData).unwrap();
    
    // Setup successful
    toast.success('Instance setup completed successfully!');
    
    // Redirect to login with new admin user
    navigate('/login');
  } catch (err) {
    console.error('Instance setup failed:', err);
  }
};
```

## Type Definitions

### Request Types

```typescript
interface SetupInstanceRequest {
  // Admin user creation
  adminUsername: string;
  adminPassword: string;
  adminEmail?: string;
  
  // Instance configuration
  instanceName: string;
  instanceDescription?: string;
  
  // Default community setup
  defaultCommunityName?: string;
  createDefaultCommunity?: boolean;
  
  // Security token
  setupToken: string; // Obtained from getOnboardingStatus
}
```

### Response Types

```typescript
interface OnboardingStatus {
  needsSetup: boolean;        // Whether instance requires setup
  hasUsers: boolean;          // Whether any users exist
  setupToken?: string;        // One-time token for setup process
}

interface SetupInstanceResponse {
  success: boolean;
  message: string;
  adminUserId: string;        // Created admin user ID
  defaultCommunityId?: string; // Created community ID (if requested)
}
```

## State Management

### Generated Hooks

```typescript
export const {
  // Query hooks
  useGetOnboardingStatusQuery,
  
  // Mutation hooks  
  useSetupInstanceMutation,
  
  // Utility hooks
  usePrefetch,
} = onboardingApi;
```

### No Authentication Required

Unlike other APIs in the system, the onboarding API doesn't require authentication:
- Uses basic `fetchBaseQuery` without auth headers
- Operates before any users exist in the system
- Uses one-time setup tokens for security

## Component Integration

### Onboarding Status Check

```typescript
import { useOnboardingApi } from '@/features/onboarding/onboardingApiSlice';

function App() {
  const { 
    data: onboardingStatus, 
    isLoading,
    error 
  } = useOnboardingApi.useGetOnboardingStatusQuery();

  // Show loading while checking onboarding status
  if (isLoading) {
    return <div className="loading-screen">Checking instance status...</div>;
  }

  // Handle onboarding status check errors
  if (error) {
    return (
      <div className="error-screen">
        <h2>Unable to Connect</h2>
        <p>Could not check instance status. Please try again.</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  // Redirect to setup if needed
  if (onboardingStatus?.needsSetup) {
    return <Navigate to="/onboarding" replace />;
  }

  // Normal app routing
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* ... other routes */}
      </Routes>
    </Router>
  );
}
```

### Onboarding Wizard

```typescript
function OnboardingWizard() {
  const { 
    data: onboardingStatus 
  } = useOnboardingApi.useGetOnboardingStatusQuery();
  
  const [setupInstance, { isLoading, error }] = useOnboardingApi.useSetupInstanceMutation();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [setupData, setSetupData] = useState<SetupInstanceRequest>({
    adminUsername: '',
    adminPassword: '',
    adminEmail: '',
    instanceName: '',
    instanceDescription: '',
    defaultCommunityName: 'General',
    createDefaultCommunity: true,
    setupToken: onboardingStatus?.setupToken || '',
  });

  const handleStepComplete = (stepData: Partial<SetupInstanceRequest>) => {
    setSetupData(prev => ({ ...prev, ...stepData }));
    setCurrentStep(prev => prev + 1);
  };

  const handleFinalSetup = async () => {
    try {
      await setupInstance(setupData).unwrap();
      
      // Setup completed successfully
      setCurrentStep(4); // Show completion step
    } catch (err) {
      console.error('Setup failed:', err);
    }
  };

  const steps = [
    { title: 'Welcome', component: WelcomeStep },
    { title: 'Instance Setup', component: InstanceSetupStep },
    { title: 'Admin Account', component: AdminSetupStep },
    { title: 'Default Community', component: CommunitySetupStep },
    { title: 'Complete', component: CompletionStep },
  ];

  const CurrentStepComponent = steps[currentStep]?.component;

  return (
    <div className="onboarding-wizard">
      <div className="wizard-header">
        <h1>Welcome to Kraken</h1>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
        <p>Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.title}</p>
      </div>

      <div className="wizard-content">
        {CurrentStepComponent && (
          <CurrentStepComponent
            data={setupData}
            onStepComplete={handleStepComplete}
            onFinalSetup={handleFinalSetup}
            isLoading={isLoading}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
```

### Instance Setup Step

```typescript
function InstanceSetupStep({ 
  data, 
  onStepComplete 
}: {
  data: SetupInstanceRequest;
  onStepComplete: (data: Partial<SetupInstanceRequest>) => void;
}) {
  const [formData, setFormData] = useState({
    instanceName: data.instanceName,
    instanceDescription: data.instanceDescription || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStepComplete(formData);
  };

  return (
    <div className="setup-step">
      <div className="step-header">
        <h2>Configure Your Instance</h2>
        <p>Set up basic information for your Kraken instance.</p>
      </div>

      <form onSubmit={handleSubmit} className="setup-form">
        <div className="form-group">
          <label htmlFor="instanceName">Instance Name *</label>
          <input
            id="instanceName"
            type="text"
            value={formData.instanceName}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              instanceName: e.target.value 
            }))}
            placeholder="My Kraken Instance"
            required
          />
          <small>This will be displayed as the name of your chat platform</small>
        </div>

        <div className="form-group">
          <label htmlFor="instanceDescription">Description</label>
          <textarea
            id="instanceDescription"
            value={formData.instanceDescription}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              instanceDescription: e.target.value 
            }))}
            placeholder="A chat platform for our team"
            rows={3}
          />
          <small>Optional description for your instance</small>
        </div>

        <div className="step-actions">
          <button type="submit" disabled={!formData.instanceName.trim()}>
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
```

### Admin Setup Step

```typescript
function AdminSetupStep({ 
  data, 
  onStepComplete 
}: {
  data: SetupInstanceRequest;
  onStepComplete: (data: Partial<SetupInstanceRequest>) => void;
}) {
  const [formData, setFormData] = useState({
    adminUsername: data.adminUsername,
    adminPassword: data.adminPassword,
    adminEmail: data.adminEmail || '',
  });

  const [passwordStrength, setPasswordStrength] = useState(0);

  const handlePasswordChange = (password: string) => {
    setFormData(prev => ({ ...prev, adminPassword: password }));
    
    // Calculate password strength
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStepComplete(formData);
  };

  return (
    <div className="setup-step">
      <div className="step-header">
        <h2>Create Admin Account</h2>
        <p>Create the first administrator account for your instance.</p>
      </div>

      <form onSubmit={handleSubmit} className="setup-form">
        <div className="form-group">
          <label htmlFor="adminUsername">Username *</label>
          <input
            id="adminUsername"
            type="text"
            value={formData.adminUsername}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              adminUsername: e.target.value 
            }))}
            placeholder="admin"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="adminEmail">Email</label>
          <input
            id="adminEmail"
            type="email"
            value={formData.adminEmail}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              adminEmail: e.target.value 
            }))}
            placeholder="admin@example.com"
          />
          <small>Optional but recommended for account recovery</small>
        </div>

        <div className="form-group">
          <label htmlFor="adminPassword">Password *</label>
          <input
            id="adminPassword"
            type="password"
            value={formData.adminPassword}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder="Create a secure password"
            required
          />
          
          <div className="password-strength">
            <div className={`strength-bar strength-${passwordStrength}`}>
              <div className="strength-fill" />
            </div>
            <span className="strength-text">
              {['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength]}
            </span>
          </div>
        </div>

        <div className="step-actions">
          <button 
            type="submit" 
            disabled={!formData.adminUsername.trim() || !formData.adminPassword || passwordStrength < 2}
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
```

### Completion Step

```typescript
function CompletionStep() {
  const navigate = useNavigate();

  return (
    <div className="setup-step completion-step">
      <div className="completion-content">
        <div className="success-icon">✅</div>
        <h2>Setup Complete!</h2>
        <p>Your Kraken instance has been configured successfully.</p>
        
        <div className="next-steps">
          <h3>What's Next?</h3>
          <ul>
            <li>Log in with your admin account</li>
            <li>Create invite codes for new users</li>
            <li>Set up additional communities</li>
            <li>Configure instance settings</li>
          </ul>
        </div>

        <div className="completion-actions">
          <button 
            onClick={() => navigate('/login')}
            className="btn btn-primary"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Error Handling

### Setup Process Errors

```typescript
const [setupInstance, { error }] = useSetupInstanceMutation();

const handleSetupError = (error: any) => {
  if (error.status === 400) {
    const { data } = error;
    if (data.field === 'adminUsername') {
      setFieldError('adminUsername', 'Username already exists or invalid');
    } else if (data.field === 'setupToken') {
      setGeneralError('Invalid setup token. Please refresh and try again.');
    } else {
      setGeneralError('Invalid setup data provided');
    }
  } else if (error.status === 403) {
    setGeneralError('Setup is not allowed or has already been completed');
  } else if (error.status === 409) {
    setGeneralError('Instance has already been set up');
  } else {
    setGeneralError('Setup failed. Please try again.');
  }
};
```

### Status Check Errors

```typescript
const { data: status, error } = useGetOnboardingStatusQuery();

if (error) {
  return (
    <div className="onboarding-error">
      <h2>Connection Error</h2>
      <p>Unable to check instance status.</p>
      <p>Please ensure the server is running and try again.</p>
      <button onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );
}
```

## Security Considerations

### Setup Token Validation

The onboarding process uses one-time setup tokens for security:

```typescript
// Setup token is provided by getOnboardingStatus
const { data: status } = useGetOnboardingStatusQuery();

// Token must be included in setup request
const setupData = {
  ...formData,
  setupToken: status?.setupToken || ''
};

// Token is invalidated after successful setup
await setupInstance(setupData);
```

### Post-Setup Security

```typescript
// After setup, redirect to secure areas
const handleSetupComplete = (response: SetupInstanceResponse) => {
  if (response.success) {
    // Clear any onboarding data
    localStorage.removeItem('onboarding-draft');
    
    // Redirect to login
    navigate('/login');
  }
};
```

## Testing

### Onboarding Status Testing

```typescript
describe('onboardingApi', () => {
  it('should fetch onboarding status successfully', async () => {
    const { result } = renderHook(
      () => onboardingApi.useGetOnboardingStatusQuery(),
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(typeof result.current.data?.needsSetup).toBe('boolean');
  });
});
```

### Instance Setup Testing

```typescript
it('should setup instance successfully', async () => {
  const setupData = {
    adminUsername: 'admin',
    adminPassword: 'secure-password',
    instanceName: 'Test Instance',
    setupToken: 'valid-token',
    createDefaultCommunity: true,
    defaultCommunityName: 'General'
  };

  const { result } = renderHook(
    () => onboardingApi.useSetupInstanceMutation(),
    { wrapper: TestProvider }
  );

  await act(async () => {
    const response = await result.current[0](setupData).unwrap();
    expect(response.success).toBe(true);
    expect(response.adminUserId).toBeDefined();
  });
});
```

## Related Documentation

- [Invite API](./inviteApi.md) - Post-setup invite management
- [Auth API](./authApi.md) - User authentication after setup
- [Users API](./usersApi.md) - User management after setup
- [Onboarding Components](../components/onboarding/) - UI components for setup process
- [Instance Setup Guide](../setup/installation.md) - Complete setup documentation
- [Admin Features](../features/auth-rbac.md#admin-features) - Post-setup admin functionality