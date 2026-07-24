// Test IDs for the auth feature (login, register, password reset, logout).
// Add new keys here as you wire up additional auth UI.
//
// Naming convention:
// - Keys use camelCase.
// - Values use kebab-case in the format:
//   <feature>-<element>
// Example:
//   login-submit-button
//   register-email-input
//   logout-button
//
// Reference them in JSX as:
// data-testid={LOGIN.submitButton}

export const LOGIN = {
	emailInput: 'login-email-input',
	passwordInput: 'login-password-input',
	submitButton: 'login-submit-button',
	forgotPasswordLink: 'login-forgot-password-link',
	registerLink: 'login-register-link',
};

export const REGISTER = {
	nameInput: 'register-name-input',
	emailInput: 'register-email-input',
	passwordInput: 'register-password-input',
	passwordConfirmInput: 'register-password-confirm-input',
	submitButton: 'register-submit-button',
	loginLink: 'register-login-link',
};

export const LOGOUT = {
	button: 'logout-button',
};
