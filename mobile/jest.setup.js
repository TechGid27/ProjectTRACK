/* eslint-disable no-undef */
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(inset),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets: inset, frame },
  };
});

// Safe stub for expo-camera: renders a host placeholder and resolves
// takePictureAsync so the field-audit capture path runs without native modules.
jest.mock('expo-camera', () => {
  const React = require('react');

  class CameraViewStub extends React.Component {
    takePictureAsync = async () => ({
      uri: 'file:///mock/site-capture.jpg',
      width: 1280,
      height: 720,
    });

    render() {
      return React.createElement('CameraViewStub', this.props);
    }
  }

  return {
    CameraView: CameraViewStub,
    Camera: {
      requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
      getCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
    },
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
    useCameraPermissions: () => [{ status: 'granted', granted: true }, jest.fn(), jest.fn()],
  };
});
