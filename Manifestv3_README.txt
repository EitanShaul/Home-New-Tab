Stuff that changes or needs fixing


"key": "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDQLTrw3Ol43TC482YiOAdhMeAa9n7pxO6y3LBor1qAZYq6Me0Psd48nSdB1mPtm1FHVfaEcCOlolZwirLe0YhpeGXNqpMqWnqAZxgJ/TcBpvpxbGqWFpemkGepVKD9szurGxaiLvFfz5OZCbkeUVW3/+RlMw0wMKZwc86nZNIHlwIDAQAB",


- check setTimeout and setInterval in service worker (bg) related code
- check XMLHTTPRequest, move to fetch() (or use offscreen.html)
- localStorage access in service worker needs `await localStorage` it has async inspiration
- 


maybe for wasm sqlite:
  "content_security_policy": {
    "extension_pages": "default-src 'self' 'wasm-unsafe-eval'"
  }

  "cross_origin_embedder_policy": {
    "value": "require-corp"
  },
  "cross_origin_opener_policy": {
    "value": "same-origin"
  },
