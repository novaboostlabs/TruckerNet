module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54) automatically adds the react-native-worklets
    // plugin (Reanimated 3/4) when react-native-worklets is installed, so the
    // launch animation's worklets compile correctly. Making the preset explicit
    // keeps that behavior guaranteed rather than relying on the implicit default.
    presets: ['babel-preset-expo'],
  };
};
