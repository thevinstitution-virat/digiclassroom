// Re-export shim: the implementation moved to the shared workspace package
// (@repo/shared) so both apps/web and apps/api use one source. Existing
// `@/lib/utils` imports keep working unchanged.
export * from '@repo/shared/utils';
