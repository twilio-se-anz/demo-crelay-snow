# Flex Plugin for ServiceNow Openframe

This Twilio Flex plugin provides ServiceNow integration using the [Openframe API](https://developer.servicenow.com/dev.do#!/reference/api/quebec/client/r_openFrameAPI-version). You must configure ServiceNow to enable Openframe. See the [ServiceNow documentation](https://docs.servicenow.com/en-US/bundle/tokyo-customer-service-management/page/product/customer-service-management/concept/c_OpenFrameOverview.html) for more information on Openframe.

## Flex Verion
This plugin supports Flex 2.0.

## Flex Configuration Service
This plugin depends on the ServiceNow Openframe Javascript library ([docs](https://docs.servicenow.com/en-US/bundle/tokyo-customer-service-management/page/product/customer-service-management/concept/c_OpenFrameOverview.html)) which is downloaded from your instance of ServiceNow. Since this URL is unique for every instance of ServiceNow, the URL has been added to the Flex Configuration Service. 

You must add the `openframe_url` property to the `attributes` object (see below) on the Flex Configuration Service for your Flex Project before this plugin will work. See the [Twilio docs](https://www.twilio.com/docs/flex/developer/plugins/creating-styling-custom-components#external-styles) for steps to update your configuration.

```json
"attributes": {
 ...
 "openframe_url":"https://<your-instance-name>.service-now.com/scripts/openframe/latest/openFrameAPI.min.js"
},
```

## Setup

Make sure you have [Node.js](https://nodejs.org) as well as [`npm`](https://npmjs.com). We support Node >= 10.12 (and recommend the _even_ versions of Node). Afterwards, install the dependencies by running `npm install`:

```bash
cd 

# If you use npm
npm install
```
