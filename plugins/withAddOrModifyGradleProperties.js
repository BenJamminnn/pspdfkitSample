const { withGradleProperties } = require("@expo/config-plugins");

// this plugin is for development purposes, since we're using expo
// and at some time will need to update jvm args and other gradle properties
// this plugin allows dynamic configuration.  This plugin was initially built to
// modify org.gradle.jvmArgs from the default of 2048m to 4096m
// this plugin runs last and will either add or modify properties
// in the gradle.properties file.  This plugin is for Android only
const withAddOrModifyGradleProperties = (config, data) => {
  return withGradleProperties(config, (config) => {
    // reformat input arguments to PropertiesItem[]
    const newProperties = Object.keys(data).map((key) => ({
      type: "property",
      key,
      value: data[key],
    }));

    // for each item, check if it already exists
    // if it does replace it, if it doesn't add it
    newProperties.forEach((prop) => {
      const property = config.modResults.find(
        (propItem) =>
          prop.type === "property" && propItem.type === prop.type && propItem.key === prop.key,
      );

      if (property && property.type === "property") {
        property.value = prop.value;
      } else if (!property) {
        config.modResults.push(prop);
      }
    });

    return config;
  });
};

module.exports = withAddOrModifyGradleProperties;
