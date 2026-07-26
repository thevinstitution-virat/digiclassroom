// Mock for superjson — ESM-only package that Jest can't transform
const superjson = {
    stringify: (value) => JSON.stringify(value),
    parse: (text) => JSON.parse(text),
    serialize: (value) => ({ json: value, meta: undefined }),
    deserialize: (payload) => payload.json || payload,
    registerClass: () => { },
    registerCustom: () => { },
    registerSymbol: () => { },
    allowErrorProps: () => { },
};

module.exports = superjson;
module.exports.default = superjson;
