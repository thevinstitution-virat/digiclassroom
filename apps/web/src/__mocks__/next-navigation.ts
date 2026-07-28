// Mock for next/navigation — Jest can't resolve App Router navigation APIs
export const useRouter = jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
    pathname: '/test',
}));

export const usePathname = jest.fn(() => '/test');

export const useSearchParams = jest.fn(() => new URLSearchParams());

export const useParams = jest.fn(() => ({}));

export const redirect = jest.fn();

export const notFound = jest.fn();
