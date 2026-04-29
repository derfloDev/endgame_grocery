# Changelog

## [0.7.0](https://github.com/derfloDev/endgame_grocery/compare/v0.6.0...v0.7.0) (2026-04-29)


### Features

* **api:** add authenticated SSE event stream ([07e69d4](https://github.com/derfloDev/endgame_grocery/commit/07e69d4d6c4c39cc5fd5e66761eb71c7fc1e434b))
* **api:** broadcast SSE events for list changes ([f6dca6b](https://github.com/derfloDev/endgame_grocery/commit/f6dca6b4f76d10e9de9b99d5ac0468914e4aa559))
* **ui:** add shared frontend SSE event context ([792ad57](https://github.com/derfloDev/endgame_grocery/commit/792ad57b03737df3d1d026b84a500a708130f38e))
* **ui:** refresh list pages from SSE updates ([b9f5d97](https://github.com/derfloDev/endgame_grocery/commit/b9f5d9727e4ff4d18be5f87cb56bf0c5c94dd4ad))

## [0.6.0](https://github.com/derfloDev/endgame_grocery/compare/v0.5.1...v0.6.0) (2026-04-29)


### Features

* **api:** add structured backend logging ([5807cd1](https://github.com/derfloDev/endgame_grocery/commit/5807cd18196b8c4a2c7424694f55c917d589f7c6))

## [0.5.1](https://github.com/derfloDev/endgame_grocery/compare/v0.5.0...v0.5.1) (2026-04-29)


### Bug Fixes

* **ci:** trigger Docker publish from Release Please releases ([ce0bbec](https://github.com/derfloDev/endgame_grocery/commit/ce0bbec1c97c816505eb7aa4858d05333a6d9364))

## [0.5.0](https://github.com/derfloDev/endgame_grocery/compare/v0.4.0...v0.5.0) (2026-04-28)


### Features

* **auth:** add password reset flow ([16262ca](https://github.com/derfloDev/endgame_grocery/commit/16262ca0f9fc0ee55e3e30ecf8aed19bd3c95662))
* **auth:** require email verification before login ([f304ca5](https://github.com/derfloDev/endgame_grocery/commit/f304ca5e0ce01e118db2a3719afad52b81a8fd53))
* **mail:** add SMTP mailer infrastructure ([7349308](https://github.com/derfloDev/endgame_grocery/commit/73493087e48e0c5dff8faff870679ec727021c1e))
* **notifications:** add shared list push alerts ([4dce143](https://github.com/derfloDev/endgame_grocery/commit/4dce143b92d29fd2a4b34c767ab0f5723fd80e2c))
* **sharing:** add invite-based list sharing flow ([1438164](https://github.com/derfloDev/endgame_grocery/commit/1438164a3fccaca25a4d40c5b1a71fe68f254bac))


### Bug Fixes

* **ci:** trigger Docker publish from GitHub releases ([5d51696](https://github.com/derfloDev/endgame_grocery/commit/5d51696b8fa9e7d63efc901ac23d1ac5d23560f3))
* **db:** correct push job jsonb default ([c60bfee](https://github.com/derfloDev/endgame_grocery/commit/c60bfee750f581fa6fa94c7f894b07dcc3c8251a))
* **e2e:** support verified-user test setup ([766bab6](https://github.com/derfloDev/endgame_grocery/commit/766bab61d87b154cfa7561fc246652335ee03358))

## [0.4.0](https://github.com/derfloDev/endgame_grocery/compare/v0.3.0...v0.4.0) (2026-04-28)


### Features

* **api:** support optional entry details ([a6e46b1](https://github.com/derfloDev/endgame_grocery/commit/a6e46b1eb6c8454ca261e91e5b70f6d2a2b79a9f))
* **ui:** add optional entry details ([27bd46e](https://github.com/derfloDev/endgame_grocery/commit/27bd46ea491a727c73cc8e554f0341bb1ce17478))
* **ui:** expand grocery, household, and health icon catalog ([9d73dba](https://github.com/derfloDev/endgame_grocery/commit/9d73dba8e4250a8f87bb5e26bc6cbd2a4acb8d80))
* **ui:** render fallback icons in history chips ([6d1d761](https://github.com/derfloDev/endgame_grocery/commit/6d1d761e770b77291825b03376e35a55055e04a4))
* **ui:** share icon resolution and picker labels ([31f2e6a](https://github.com/derfloDev/endgame_grocery/commit/31f2e6a8b5bb7569d3e52cacf048a05128e7716b))


### Bug Fixes

* **pwa:** send manifest credentials behind Cloudflare Access ([549ea7e](https://github.com/derfloDev/endgame_grocery/commit/549ea7e5bdd41c96aea50e6614fd4a82f67ee499))

## [0.3.0](https://github.com/derfloDev/endgame_grocery/compare/v0.2.0...v0.3.0) (2026-04-28)


### Features

* **ai:** autocomplete ([df12df2](https://github.com/derfloDev/endgame_grocery/commit/df12df23d172577cafbc01dd738e66aa0d883ea1))
* **ui:** add overview info and settings sheet ([8a47217](https://github.com/derfloDev/endgame_grocery/commit/8a472171bda6fe82601c31b5e19c8800d46a1a66))


### Miscellaneous Chores

* **release:** correct release version to 0.3.0 ([e8c602d](https://github.com/derfloDev/endgame_grocery/commit/e8c602d184a45d4375eecb3a8f54c1e5de91a784))

## [0.2.0](https://github.com/derfloDev/endgame_grocery/compare/v0.1.0...v0.2.0) (2026-04-27)


### Features

* **backend:** persist grocery entry icons ([66531a2](https://github.com/derfloDev/endgame_grocery/commit/66531a2afb8e0fb326a77b233f1b13b908d66436))
* **frontend:** add a shared full-catalogue icon picker ([6589999](https://github.com/derfloDev/endgame_grocery/commit/6589999f59a92cc5e36f3ed3863d882dd9399a81))
* **frontend:** add bilingual grocery icon matching data ([5d1f73e](https://github.com/derfloDev/endgame_grocery/commit/5d1f73e7ce13168cdb618a0cbf636786b53f97aa))
* **frontend:** add icon editing to grocery list entries ([2947d82](https://github.com/derfloDev/endgame_grocery/commit/2947d82475712d4e096f42de1c2f9b93e02fb133))
* **frontend:** add inline icon picking to the add-item sheet ([f86cbf1](https://github.com/derfloDev/endgame_grocery/commit/f86cbf1cc635250d2e5b997e8733ccddc3d3e951))
* **frontend:** add local grocery icon suggestion engine ([8131956](https://github.com/derfloDev/endgame_grocery/commit/813195661fa00d5570f4dfc42898ff9c34528f03))
* **frontend:** browse more grocery icons without leaving the item sheet ([6d26137](https://github.com/derfloDev/endgame_grocery/commit/6d26137647282f4c826ff4b15b22c82a12f062d2))
* **frontend:** edit grocery entries in the shared item sheet ([65a6e66](https://github.com/derfloDev/endgame_grocery/commit/65a6e6650477fe16d9a93b20bb142ea9dad7f58a))
* **frontend:** expand the item-sheet icon browser inline ([16dfe1f](https://github.com/derfloDev/endgame_grocery/commit/16dfe1ff3e8d3139d70427f46a319e9f39c383bd))
* **frontend:** preview grocery icons while adding items ([399e145](https://github.com/derfloDev/endgame_grocery/commit/399e14568300d8607d68a0a5c01f1650d0323208))
* **frontend:** return top icon matches from the suggestion worker ([ff8c76c](https://github.com/derfloDev/endgame_grocery/commit/ff8c76c1211b57dfd4380a28b30683f902cafaf6))
* **frontend:** show grocery icons in list entries ([56eb028](https://github.com/derfloDev/endgame_grocery/commit/56eb0285722c0a94d57152dcdc1aee1264ba86ff))
* **frontend:** switch grocery icon matching to Tabler icon names ([36e2931](https://github.com/derfloDev/endgame_grocery/commit/36e2931a3bc0c88abc96250dfa946eedb6f473eb))
* **ui:** add Endgame design tokens and dark app shell ([2b43f84](https://github.com/derfloDev/endgame_grocery/commit/2b43f846babe540526ac00a8e064b1253c1e4a1e))
* **ui:** add shared Endgame UI component library ([c8009f3](https://github.com/derfloDev/endgame_grocery/commit/c8009f371b3d200d8c554a4086cd0e764d1ff6d8))
* **ui:** apply dark design to auth pages ([a3a3769](https://github.com/derfloDev/endgame_grocery/commit/a3a376920b68e23c97ac0f76bcb2dddd4b180df0))
* **ui:** redesign list detail page with neon theme and swipe-to-delete ([e65c925](https://github.com/derfloDev/endgame_grocery/commit/e65c925659e8479344e96482b381b4f8ea04793c))
* **ui:** redesign overview page as Endgame home screen ([8a32045](https://github.com/derfloDev/endgame_grocery/commit/8a32045e239c1057587bcb1b287e43a6ba99325e))
* **ui:** replace list detail share button with options flyout and add rename ([7d767fe](https://github.com/derfloDev/endgame_grocery/commit/7d767fe1c52238cfe8ad547f10f5d1b7cba2363e))


### Bug Fixes

* **frontend:** alias onnxruntime-web to self-contained build to fix Worker crash ([4d8b38a](https://github.com/derfloDev/endgame_grocery/commit/4d8b38a37beabdaf75b02638ef80a93b986eb2bf))
* **frontend:** recover icon suggestions after worker failures ([5bd0903](https://github.com/derfloDev/endgame_grocery/commit/5bd0903a8204d7822094c50aeb5be326ee2c4296))
* **frontend:** remove the extra scrollbar from the icon browser ([7ba2cb9](https://github.com/derfloDev/endgame_grocery/commit/7ba2cb9fdb6f5ead329317370a8a6f3b7a993ee9))
* **frontend:** restore unclipped focus rings in the item sheet ([0430ed8](https://github.com/derfloDev/endgame_grocery/commit/0430ed8eee7ae69a84771e68b545f1840a247b8a))
* **frontend:** use a not-allowed cursor for disabled item actions ([9518d47](https://github.com/derfloDev/endgame_grocery/commit/9518d47bbda7c86a63fad417154e0e33383c801a))
* **release:** bootstrap Release Please from the v0.1.0 baseline ([42da403](https://github.com/derfloDev/endgame_grocery/commit/42da4030226c7f0691ac4e9fe5649cb3719ce0ee))
* **ui:** add gap between list detail section cards and done header spacing ([df9f2ba](https://github.com/derfloDev/endgame_grocery/commit/df9f2ba5e9223ea975ee323d243f163b981bfdf6))
* **ui:** add spacing-scale tokens and fix spacing inconsistencies ([f0d0a23](https://github.com/derfloDev/endgame_grocery/commit/f0d0a23b63ce05f29a71c47f158bd2d7c641cbaa))
* **ui:** remove double top padding from Open Items card header ([098d16e](https://github.com/derfloDev/endgame_grocery/commit/098d16e491c2fab1605d6d6625bdc8c83f6ad735))
* **ui:** restore symmetric Done card padding by using sibling margin instead of button padding ([a2fa637](https://github.com/derfloDev/endgame_grocery/commit/a2fa637f3189ac3f8a66cdc644a1c339d70258f0))


### Miscellaneous Chores

* **release:** correct release version to 0.2.0 ([af213f8](https://github.com/derfloDev/endgame_grocery/commit/af213f844d31ea0923be33ccf815949456b7236c))
