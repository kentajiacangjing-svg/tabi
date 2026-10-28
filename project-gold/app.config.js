// app.json を基本に、ブラウザ完結デモのビルド時（DEMO_BUILD=1）だけ設定を上書きする。
// デモは1つのページとして配布するため、ルートごとの分割読み込み（asyncRoutes）を無効にする。
module.exports = ({ config }) => {
  if (process.env.DEMO_BUILD !== '1') return config;
  return {
    ...config,
    plugins: config.plugins.map((p) => (p === 'expo-router' ? ['expo-router', { asyncRoutes: false }] : p)),
  };
};
