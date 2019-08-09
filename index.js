'use strict';

const Alexa = require('alexa-sdk');
var https = require('https');
const AlexaDeviceAddressClient = require('./AlexaDeviceAddressClient');
const BarFunctions = require('./functions/BarFunctions');
const VoiceConstants = require('./constants/VoiceConstants');

var NodeGeocoder = require('node-geocoder');
var options = {
  provider: 'google',
 
  // Optional depending on the providers
  httpAdapter: 'https', // Default
  apiKey: SECRET, // for Mapquest, OpenCage, Google Premier
  formatter: null         // 'gpx', 'string', ...
};
 
var geocoder = NodeGeocoder(options);

var currentLatLong="";
var latitude = "";
var longitude = ""
var category = "bars";
var currentBar = {};
var locationBased = false;

const ALL_ADDRESS_PERMISSION = "read::alexa:device:all:address";

const PERMISSIONS = [ALL_ADDRESS_PERMISSION];

const APP_ID = "amzn1.ask.skill.6e317767-6687-4342-b55a-8104e60925b4";
var fullCity = "";

const handlers = {
    'LaunchRequest': function () {
        this.emit(':ask', VoiceConstants.WELCOME);
    },
    'searchBars': function(){
        category = BarFunctions.getCategory(this.event.request.intent.slots["barType"]["value"]);
        var city = this.event.request.intent.slots["city"]["value"];
        latitude = "";
        longitude = "";
        if(city){
            locationBased=false;
            Bars = [];
            geocoder.geocode(city, function(err, res) {
                latitude = res[0].latitude;
                longitude = res[0].longitude;
                currentLatLong=latitude+","+longitude+"-"+category;
                fullCity = res[0].formattedAddress.split(",")[0];
                BarFunctions.searchForBars(currentLatLong, this, latitude, longitude, category,fullCity, 1)
            });
        } else{
            locationBased=true;
            var consentToken;
            var deviceId;
            var apiEndpoint;
            try {
                consentToken = this.event.context.System.user.permissions.consentToken;
                deviceId = this.event.context.System.device.deviceId;
                apiEndpoint = this.event.context.System.apiEndpoint;

                if(!consentToken || !deviceId || !apiEndpoint) {
                    throw("User did not give us permissions to access their address.");
                }
                
            } catch(e) {
                this.emit(":tellWithPermissionCard", VoiceConstants.ASK_LOCATION_PERMISSION, PERMISSIONS);
                // Lets terminate early since we can't do anything else.
                console.log(JSON.stringify(this.event));
                console.error(e);
                return;
            }
            
            const alexaDeviceAddressClient = new AlexaDeviceAddressClient(apiEndpoint, deviceId, consentToken);
            let deviceAddressRequest = alexaDeviceAddressClient.getFullAddress();

            deviceAddressRequest.then((addressResponse) => {
                if(addressResponse.statusCode==200){
                    console.log("Address successfully retrieved, now responding to user.");
                    const address = addressResponse.address;
                    var ADDRESS_MESSAGE = "";
                    if(address['addressLine1']){
                        ADDRESS_MESSAGE = address['addressLine1']+", "+address['stateOrRegion']+", "+address['postalCode'];
                    } else{
                        ADDRESS_MESSAGE = address['postalCode']+", "+address['countryCode'];
                    }
                    geocoder.geocode(ADDRESS_MESSAGE, function(err, res) {
                        latitude = res[0].latitude;
                        longitude = res[0].longitude;
                        currentLatLong=latitude+","+longitude+"-"+category;
                        fullCity = res[0].formattedAddress.split(",")[0];
                        BarFunctions.searchForBars(currentLatLong, this, latitude, longitude, category,fullCity, 0);
                    });                
                } else if(addressResponse.statusCode==204){
                    // This likely means that the user didn't have their address set via the companion app.
                    console.log("Successfully requested from the device address API, but no address was returned.");
                    this.emit(":tell", VoiceConstants.TELL_SET_ADDRESS);
                } else if(addressResponse.statusCode==403){
                    console.log("The consent token we had wasn't authorized to access the user's address.");
                    this.emit(":tellWithPermissionCard",VoiceConstants.TELL_SET_PERMISSIONS, PERMISSIONS);
                } else{
                    this.emit(":ask", VoiceConstants.ERROR_DEVICE_ADDR_API, VoiceConstants.ERROR_DEVICE_ADDR_API);
                }

            });

            deviceAddressRequest.catch((error) => {
                this.emit(":tell", VoiceConstants.SOMETHING_WRONG);
                console.error(error);
            });
        };
    },
    'pricing': function () {
        var pricing = currentBar.price;
        var description = BarFunctions.getPricingDesc(pricing);
        this.emit(':ask', VoiceConstants.CAN_TELL_MORE.format(description));
    },
    'rating': function () {
        var rating = currentBar.rating;
        this.emit(':ask',VoiceConstants.CAN_TELL_MORE.format(VoiceConstants.RATING.format(rating)));
    },
    'whereIsIt': function () {
        try{
            var address = currentBar.location.display_address;
            var distanceStr = "";
            if(locationBased){
                var distance = BarFunctions.getMiles(currentBar.distance);
                distanceStr = VoiceConstants.DISTANCE.format(distance.toFixed(2);
            }
            try{
                this.emit(':ask', VoiceConstants.CAN_TELL_MORE.format(VoiceConstants.LOCATION_CITY.format(address[0],address[1].split(",")[0]+distanceStr)));
            } catch(e){
                this.emit(':ask', VoiceConstants.CAN_TELL_MORE.format(VoiceConstants.LOCATION.format(address.toString()+distanceStr)));
            }
        } catch(e){
            this.emit(':ask', VoiceConstants.LOCATION_ERROR);
        }
    },
    'hours': function () {
        var barId = currentBar.id;
        var currentDay =  (new Date()).getDay();
        if(currentDay>0){
            currentDay = currentDay-1;
        } else{
            currentDay = 6;
        }
        if(this.event.request.intent.slots 
            && this.event.request.intent.slots["currentDay"] 
                    && this.event.request.intent.slots["currentDay"]["value"]){
            currentDay = daysInWeek.indexOf(this.event.request.intent.slots["currentDay"]["value"].toLowerCase());
        }
        BarFunctions.businessLookup(barId, currentDay, this);
    },
    'moreInfo':function() {
        BarFunctions.getRandomIntent(this);
    },
    'AMAZON.HelpIntent': function () {
        this.emit(':ask', VoiceConstants.UTTER_EXAMPLE);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', VoiceConstants.UTTER_DRINK_RESPONSIBLY);
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', VoiceConstants.UTTER_DRINK_RESPONSIBLY);
    },
    'Unhandled': function () {
        this.emit(':tell', VoiceConstants.UNHANDLED);
    },
};

exports.handler = function (event, context) {
    const alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.registerHandlers(handlers);
    alexa.execute();
};

String.prototype.format = function() {
  return [...arguments].reduce((p,c) => p.replace(/%s/,c), this);
};