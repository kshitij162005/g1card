/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare function notify(message?: unknown): void;

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdInitializeConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

interface GoogleIdRenderButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  width?: number;
}

interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (options: GoogleIdInitializeConfig) => void;
        renderButton: (parent: HTMLElement, options: GoogleIdRenderButtonOptions) => void;
      };
    };
  };
}
