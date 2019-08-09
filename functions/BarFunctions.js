
var CacheBars = {};
var Bars = [];

const yelp = require('yelp-fusion');
const apiKey = SECRET
const client = yelp.client(apiKey);

var offset=0;

function searchForBars(currentLatLong,alexa, latitude, longitude, category,fullCity, isOffset){
    if(isOffset){
        offset=0;
    }
    if(!CacheBars[currentLatLong]|| (CacheBars[currentLatLong] && CacheBars[currentLatLong].length==0)){
        client.search({
            categories:category,
            latitude:latitude,
            longitude:longitude,
            term:'bars',
            sort_by:'best_match',
            radius:1609,
            offset:offset,
            limit:50,
            attributes:'RestaurantsGoodForGroups,LikedByTwenties,Alcohol.full_bar',
        }).then(response => {
            Array.prototype.push.apply(Bars,response.jsonBody['businesses']);
            offset+=50;
            if(response.jsonBody['businesses'].length==50)
                searchForBars();
            else
                randomInstance(Bars, currentLatLong, fullCity, alexa);
        }).catch(e => {
            console.log("in catch");
            console.log(e);
            alexa.emit(':tell', VoiceConstants.ERROR_LOAD);


        });
    } else{
        randomInstance(CacheBars[currentLatLong], currentLatLong, fullCity, alexa);
    }

}

function randomInstance(array, currentLatLong, fullCity, alexa){
    CacheBars[currentLatLong] = array;
    if(array.length==0){
        if(fullCity=="")
            fullCity="there";
        alexa.emit(':ask',VoiceConstants.CANT_FIND.format(alexa.event.request.intent.slots["barType"]["value"], fullCity));
    }
    var index = Math.floor(Math.random() * (array.length))
    if(!array[index].is_closed){
        currentBar = array[index];
        var cardString = array[index].name+" is a "+getBarDesc(array[index])+" located at "+array[index].location.display_address[0]+" in "+array[index].location.display_address[1].split(",")[0];
        var cardImg = array[index].image_url;
        var newName = array[index].name.replace("'","").replace("&","and");
        var reprompt = "feel free to ask about "+newName;
        alexa.emit(':askWithCard',VoiceConstants.CAN_TELL_MORE.format(newName),reprompt,newName,cardString,cardImg);
    }
    else
        randomInstance(array, currentLatLong, fullCity, alexa);
}

function getMiles(i) {
     return i*0.000621371192;
}

function getCategory(barSlot){
    console.log("lookup bar slot: "+barSlot);
    switch(barSlot){
        case "gay bar":
            return "gaybars";
        case "wine bar":
            return "wine_bars";
        case "karaoke bar":
            return "karaoke";
        case "irish pub":
            return "irish_pubs";
        case "pub":
            return "pubs";
        case "night club":
        case "club":
            return "lounges,danceclubs";
        case "dive bar":
            return "divebars";
        case "sports bar"
            return "sportsbars";
        case "dance club":
            return "danceclubs";
        case "bar":
        case "bars":
        default:
            return "bars";
    }
}

function getPricingDesc(pricing){
    switch(pricing){
        case "$":
            return VoiceConstants.ONE_DOLLAR_SIGN;
        case "$$":
            return VoiceConstants.TWO_DOLLAR_SIGN;
        case "$$$":
            return VoiceConstants.THREE_DOLLAR_SIGN;
        case "$$$$":
            return VoiceConstants.FOUR_DOLLAR_SIGN;
        default:
            return VoiceConstants.NO_PRICING_DATA;
    }
}

function getBarDesc(chosenBar){
    var barCats = chosenBar.categories;
    var outputStr = "";
    for(var i=0; i<barCats.length; i++){
        var name = barCats[i].title.split("(")[0];
        if(name.slice(-1)=="s")
            name=name.substring(0,name.length-1);
        if(i<barCats.length-1)
            outputStr+=name+", ";
        else
            outputStr+=name;
    }
    return outputStr+" kind of place "

}

function businessLookup(id,currentDay,alexa){
    client.business(id).then(response => {
            response = response.jsonBody;
            var start = null;
            var end = null;
            if(response==null || response.hours==null)
                throw  ("got a null response from the lookup");
            for(var i = 0; i<response.hours[0].open.length; i++){
                console.log(i);
                console.log(response.hours[0].open[i]);
                if(response.hours[0].open[i].day==currentDay){
                    start = parseInt(response.hours[0].open[i].start)
                    end = parseInt(response.hours[0].open[i].end);
                    break;
                }
            }
            if(start!=null && end!=null){
                console.log("start time for "+currentDay+" "+start);
                console.log("end time for "+currentDay+" "+end);
                var amOrPm = " PM ";
                var amOrPmEnd = " PM ";
                if(start<1200){
                    amOrPm = " AM ";
                } else if (start>1259){
                    start = start-1200;
                } if(start==0){
                    amOrPm = " AM ";
                    start=1200;
                }
                var startMins = start.toString().slice(-2);
                if(start.toString().length>3){
                    var startHours = start.toString().charAt(0)+start.toString().charAt(1);
                } else{
                    var startHours = start.toString().charAt(0);
                }
                if(end<1200){
                    amOrPmEnd = " AM ";
                } else if (end>1259){
                    end = end-1200;
                } if(end==0){
                    amOrPmEnd = " AM ";
                    end=1200;
                }
                var endMins = end.toString().slice(-2);
                if(end.toString().length>3){
                    var endHours = end.toString().charAt(0)+end.toString().charAt(1);
                } else{
                    var endHours = end.toString().charAt(0);
                }
                var str =response.name.replace("'","").replace("&","and")+" opens at "+startHours + ":"+startMins +amOrPm+" and closes at "+endHours+":"+endMins+amOrPmEnd+" on "+daysInWeek[currentDay]+"s";
            } else{
                var str =response.name.replace("'","").replace("&","and")+" is not open on "+daysInWeek[currentDay]+"s";
            }

            alexa.emit(':ask', VoiceConstants.CAN_TELL_MORE.format(str));
        }).catch(e => {
            console.log("in catch");
            console.log(e);
            alexa.emit(':ask', VoiceConstants.ERROR_LOAD);
        });
}

function getRandomIntent(alexa){
    var index = Math.floor(Math.random() * (moreInfoIntents.length))
    alexa.emit(moreInfoIntents[index]);
}
var daysInWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday','sunday'];
var moreInfoIntents = ['pricing','rating','whereIsIt','hours']


String.prototype.format = function() {
  return [...arguments].reduce((p,c) => p.replace(/%s/,c), this);
};