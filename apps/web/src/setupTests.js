// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";


// Note: don't import Zustand stores here. This file runs before each test file's
// jest.mock() calls take effect, so stores imported here would capture the real
// services. Test files reset stores themselves via test-utils/reset-stores.js.
