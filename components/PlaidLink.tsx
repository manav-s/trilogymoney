"use client";

import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkProps {
  onSuccess: (publicToken: string, metadata: any) => void;
  onError?: (error: any) => void;
  onExit?: () => void;
  className?: string;
  children: React.ReactNode;
}

export default function PlaidLink({ 
  onSuccess, 
  onError, 
  onExit, 
  className = "",
  children 
}: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch link token on component mount
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const response = await fetch('/api/plaid/link-token', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch link token');
        }

        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (error) {
        console.error('Error fetching Plaid link token:', error);
        if (onError) {
          onError(error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchLinkToken();
  }, [onError]);

  const config = {
    token: linkToken,
    onSuccess: (publicToken: string, metadata: any) => {
      console.log('Plaid Link successful:', { publicToken, metadata });
      onSuccess(publicToken, metadata);
    },
    onError: (error: any) => {
      console.error('Plaid Link error:', error);
      if (onError) {
        onError(error);
      }
    },
    onExit: () => {
      console.log('Plaid Link exited');
      if (onExit) {
        onExit();
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready && linkToken) {
      open();
    }
  };

  if (isLoading) {
    return (
      <button disabled className={`${className} opacity-50 cursor-not-allowed`}>
        Loading...
      </button>
    );
  }

  if (!linkToken) {
    return (
      <button disabled className={`${className} opacity-50 cursor-not-allowed`}>
        Connection Error
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!ready}
      className={`${className} ${!ready ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}
