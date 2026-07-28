import { useEffect } from 'react';

export interface RazorpayOptions {
  key?: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  image?: string;
  order_id: string;
  handler?: (response: any) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
  onFailure?: (response: any) => void;
}

export function useRazorpay() {
  const openCheckout = (options: RazorpayOptions) => {
    // @ts-ignore - Razorpay is loaded globally via script tag
    const rzp = new window.Razorpay(options);
    if (options.onFailure) {
      rzp.on('payment.failed', options.onFailure);
    }
    rzp.open();
  };

  useEffect(() => {
    // Only load the script if it isn't already loaded
    if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
      
      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, []);

  return { openCheckout };
}
