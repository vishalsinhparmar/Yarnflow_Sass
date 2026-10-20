export const getAuthErrorDetails = (error, action = 'login') => {
  const status = Number(error?.status) || 0;
  const code = error?.code;

  if (code === 'REQUEST_TIMEOUT') {
    return {
      type: 'maintenance',
      title: 'YarnFlow is taking too long to respond',
      message: error?.message || 'The request timed out before the server responded.',
      helpText: 'The system may be busy or under maintenance. Please try again.',
      canRetry: true,
    };
  }

  if (code === 'NETWORK_ERROR' || status === 0) {
    return {
      type: 'network',
      title: 'Cannot connect to YarnFlow',
      message: 'The server may be under maintenance, or your internet connection may be unavailable.',
      helpText: 'Check your connection, then try again. Your information has not been lost.',
      canRetry: true,
    };
  }

  if (status === 503 || code === 'SERVICE_UNAVAILABLE') {
    return {
      type: 'maintenance',
      title: 'YarnFlow is temporarily unavailable',
      message: error?.message || 'The system is currently undergoing maintenance.',
      helpText: 'Please wait a few minutes and try again. Your data remains safe.',
      canRetry: true,
    };
  }

  if (status === 401 || code === 'INVALID_CREDENTIALS') {
    return {
      type: 'credentials',
      title: 'Sign-in failed',
      message: error?.message || 'The company code, email / username or password is incorrect.',
      helpText: 'Check your credentials and try again.',
      canRetry: false,
    };
  }

  if (status === 403 || code === 'ACCOUNT_DISABLED') {
    return {
      type: 'account',
      title: 'Account access disabled',
      message: error?.message || 'This account is currently disabled.',
      helpText: 'Contact your YarnFlow system administrator for assistance.',
      canRetry: false,
    };
  }

  if (status === 409 || code === 'EMAIL_ALREADY_REGISTERED') {
    return {
      type: 'account',
      title: 'Account already exists',
      message: 'An account with this email address is already registered.',
      helpText: 'Sign in with this email address instead.',
      canRetry: false,
    };
  }

  if (status === 429) {
    return {
      type: 'maintenance',
      title: 'Too many attempts',
      message: 'For your security, sign-in attempts have been temporarily limited.',
      helpText: 'Wait a few minutes before trying again.',
      canRetry: false,
    };
  }

  if (status === 400 || code === 'VALIDATION_ERROR') {
    return {
      type: 'validation',
      title: action === 'register' ? 'Registration could not be completed' : 'Check your details',
      message: error?.message || 'Some of the information provided is not valid.',
      helpText: 'Review the information and try again.',
      canRetry: false,
    };
  }

  return {
    type: 'system',
    title: action === 'register' ? 'Registration unavailable' : 'Sign-in unavailable',
    message: 'YarnFlow could not complete your request due to an unexpected error.',
    helpText: 'Please try again. If the issue continues, contact your system administrator.',
    canRetry: error?.retryable !== false,
  };
};
