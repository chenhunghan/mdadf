# Changelog

## [0.1.5](https://github.com/chenhunghan/mdadf/compare/mdadf-v0.1.4...mdadf-v0.1.5) (2026-04-04)


### Documentation

* update README ([1d1249d](https://github.com/chenhunghan/mdadf/commit/1d1249d4f9bba60f67ffa4bfdc86f31f613242cd))
* update README ([d718c18](https://github.com/chenhunghan/mdadf/commit/d718c180b478371ec05e4f38ac83549b64e4625d))

## [0.1.4](https://github.com/chenhunghan/mdadf/compare/mdadf-v0.1.3...mdadf-v0.1.4) (2026-04-04)


### Features

* add install scripts for all platforms with checksum verification ([f2a25af](https://github.com/chenhunghan/mdadf/commit/f2a25af6df01c571c9389243ee16afbb9bea7fde))
* add mdadf-cli agent skill with evals and install docs ([22d1ee1](https://github.com/chenhunghan/mdadf/commit/22d1ee18acb38e269e810539e26dfe6e0f799a2b))


### Bug Fixes

* abort on missing checksum tool, use exact filename match in checksum lookup ([ba1e336](https://github.com/chenhunghan/mdadf/commit/ba1e3367af7d1182946acf2df6b69af22b5d704d))
* exit immediately when stdin is a TTY with no input ([f01f9e6](https://github.com/chenhunghan/mdadf/commit/f01f9e65cae73de5a45241cac4ac2b4cf05030ca))
* reject multiple file args, add CLI E2E tests for coverage gaps ([ac7c08e](https://github.com/chenhunghan/mdadf/commit/ac7c08e2bcace37072e5a55663674e74d6c93c63))


### Documentation

* add README with install and usage instructions ([3af69ea](https://github.com/chenhunghan/mdadf/commit/3af69eaad50314033f52433fe67738681147860f))
* simplify agent skill install instructions ([dd29c78](https://github.com/chenhunghan/mdadf/commit/dd29c789a537f902fff5c91d711d0f2b0840268e))


### Miscellaneous

* remove .omx from tracking, add to gitignore ([73a5bcf](https://github.com/chenhunghan/mdadf/commit/73a5bcf0497ff32c58a314dda347a9c24c864c9e))

## [0.1.3](https://github.com/chenhunghan/mdadf/compare/mdadf-v0.1.2...mdadf-v0.1.3) (2026-04-04)


### Bug Fixes

* bump bun to 1.3.10 for windows-arm64 compile support, restore all 6 targets ([7032918](https://github.com/chenhunghan/mdadf/commit/7032918366022a95aba297da72b13a168d7e2361))
* remove unsupported bun-windows-arm64 target, add fail-fast: false ([65bf2f1](https://github.com/chenhunghan/mdadf/commit/65bf2f188061171f58e48b37a19d226b56017c36))

## [0.1.2](https://github.com/chenhunghan/mdadf/compare/mdadf-v0.1.1...mdadf-v0.1.2) (2026-04-04)


### Bug Fixes

* address P1/P2 security and correctness findings ([0bd4be9](https://github.com/chenhunghan/mdadf/commit/0bd4be9f512399803d78acc5a7f0ef4ea12eb414))

## [0.1.1](https://github.com/chenhunghan/mdadf/compare/mdadf-v0.1.0...mdadf-v0.1.1) (2026-04-04)


### Features

* initial mdadf CLI — Markdown to ADF converter ([5a5c62a](https://github.com/chenhunghan/mdadf/commit/5a5c62ac2e03b87d06c5c1a05addf52f9402626d))


### Bug Fixes

* address adversarial review findings and update dependencies ([d3464a7](https://github.com/chenhunghan/mdadf/commit/d3464a74d4189dae2113229bb57a5f746943ac37))
* use bunx for oxfmt in CI (not in PATH) ([b936120](https://github.com/chenhunghan/mdadf/commit/b936120ca86c9ab86a2482aa74ec48530d039722))


### Miscellaneous

* add .pruner/ to gitignore ([5da688f](https://github.com/chenhunghan/mdadf/commit/5da688f13250be12a19699bb640a2eb8193840fa))
