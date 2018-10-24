const fs = require('fs'),
  path = require('path'),
  PNGImage = require('pngjs-image');
const requireImageSize = {
  width: 1024,
  height: 512
};

let AuroraMap = {};

AuroraMap.heatMapColors = {
  '0': { red: 0, green: 104, blue: 55, alpha: 255 },
  '5': { red: 26, green: 152, blue: 80, alpha: 255 },
  '10': { red: 102, green: 189, blue: 99, alpha: 255 },
  '15': { red: 166, green: 217, blue: 106, alpha: 255 },
  '20': { red: 217, green: 239, blue: 139, alpha: 255 },
  '50': { red: 254, green: 224, blue: 139, alpha: 255 },
  '60': { red: 253, green: 174, blue: 97, alpha: 255 },
  '70': { red: 244, green: 109, blue: 67, alpha: 255 },
  '80': { red: 215, green: 48, blue: 39, alpha: 255 },
  '90': { red: 165, green: 0, blue: 38, alpha: 255 }
};

AuroraMap.heatMapColorCalculator = activity => {
  let percentPerHex = 255 / 100;
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = AuroraMap.easeOutExpo(activity, 0, 225, 100);
  if (activity > 0 && activity <= 50) {
    red = Math.round(percentPerHex * activity);
    green = 255;
  } else {
    red = 255;
    green = Math.round(percentPerHex * (100 - activity));
  }
  return {
    red: red,
    green: green,
    blue: blue,
    alpha: alpha
  };
}

AuroraMap.easeOutExpo = (t, b, c, d) => {
  //http://gizma.com/easing/
  return c * ( -Math.pow( 2, -10 * t / d ) + 1 ) + b;
}

AuroraMap.version = require('./package.json').version;

AuroraMap.parseAuroraActivityData = rawData => {
  let data = rawData.split('#');
  data = data[data.length - 1].replace(/\n/, '');
  let latitudes = data.split('\n');
  latitudes.splice(512, latitudes.length);
  let dataPoints = [];
  latitudes.forEach(latitude => {
    longitudes = latitude.replace(/\s{2,}/g, ',').split(',');
    longitudes.shift();
    dataPoints.push(longitudes);
  });
  return dataPoints.reverse();
}

AuroraMap.getUTCDateString = () => {
  let date = new Date();
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  if (month < 10) month = '0' + month;
  let day = date.getUTCDate();
  if (day < 10) day = '0' + day;
  let hour = date.getUTCHours();
  if (hour < 10) hour = '0' + hour;
  let minute = date.getUTCMinutes();
  if (minute < 10) minute = '0' + minute;
  let second = date.getUTCSeconds();
  if (second < 10) second = '0' + second;
  let dateString = year + '/' + month + '/' + day + ' ' +
  hour + ':' + minute + ':' + second + ' UTC';
  return dateString;
}

AuroraMap.getFileSystemSafeUTCDateString = () => {
  return AuroraMap.getUTCDateString().replace(/\//g, '-').replace(/\s/g, '--').replace(/:/g, '-');
}

AuroraMap.colorMix = (oldColor, newColor) => {
  let percentageAlpha = newColor.alpha / 255;
  let newRed = Math.round((oldColor.red + (newColor.red * percentageAlpha)) / (1 + percentageAlpha));
  let newGreen = Math.round((oldColor.green + (newColor.green * percentageAlpha)) / (1 + percentageAlpha));
  let newBlue = Math.round((oldColor.blue + (newColor.blue * percentageAlpha)) / (1 + percentageAlpha));

  return {
    red: newRed,
    green: newGreen,
    blue: newBlue,
    alpha: Math.max(oldColor.alpha, newColor.alpha)
  };
}

AuroraMap.colorForActivity = activity => {
  if (activity == 0) return null;
  let color = null;
  Object.keys(AuroraMap.heatMapColors).forEach(level => {
    if (activity > parseInt(level)) color = AuroraMap.heatMapColors[level];
  });
  return color;
}

AuroraMap.generateMap = (rawData, output, callback) => {
  let cb = (err, file) => {
    if (typeof callback  === 'function') {
      callback(err, file);
    }
  }
  let basemap = path.join(path.dirname(fs.realpathSync(__filename)), './maps/basemap-512.png');
  PNGImage.readImage(basemap, (err, baseImage) => {
    if (err) return cb(err);
    if (requireImageSize.width !== baseImage.getWidth() || requireImageSize.height !== baseImage.getHeight()) {
      return cb('Wrong image size. Requires a image size of 1024x512');
    }
    let image = PNGImage.copyImage(baseImage);
    AuroraMap.parseAuroraActivityData(rawData).forEach((latitude, lat) => {
      latitude.forEach((activity, lon) => {
        if (activity > 0) {
          let activityColor = AuroraMap.heatMapColorCalculator(activity);
          let idx = image.getIndex(lon, lat);
          let newColor = AuroraMap.colorMix({
            red: image.getRed(idx),
            green: image.getGreen(idx),
            blue: image.getBlue(idx),
            alpha: image.getAlpha(idx)
          }, activityColor);
          image.setAt(lon, lat, newColor);
        }
      });
    });
    image.writeImage(output, err => {
      if (err) return cb(err);
      cb(null, output);
    });
  });
}

module.exports = AuroraMap;
