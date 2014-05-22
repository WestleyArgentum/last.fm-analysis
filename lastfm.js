
var API_KEY = process.argv[2];
if (!API_KEY) {
    console.log("The first argument to this script is a lastfm api key.\nGet one here: http://www.last.fm/api/account/create");
    return;
}

var NUM_ARTISTS = process.argv[3] || 1000;

var request = require("request");

// getTopArtists will query for `num` artists and invoke a
// callback with an array of the artist data
function getTopArtists(num, cb) {
    num = num || 50;

    var options = {
        url: 'http://ws.audioscrobbler.com/2.0',
        qs: {
            'api_key': API_KEY.toString(),
            'method': 'chart.gettopartists',
            'limit': num,
            'format': 'json'
        }
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            data = JSON.parse(body);
            cb(data['artists']['artist']);
        }
    });
}

// getTopTags will query for the top tags of the `artist` and
// invoke a callback with the artist name and an array of tag data
function getTopTags(artist, cb) {
    var options = {
        url: 'http://ws.audioscrobbler.com/2.0',
        qs: {
            'api_key': API_KEY.toString(),
            'method': 'artist.gettoptags',
            'artist': artist,
            'format': 'json'
        }
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            data = JSON.parse(body);
            cb(artist, data['toptags']['tag']);
        }
    });
}

// showTagPairs will take in a dictionary of { [tag_pair]: associated_count },
// and display tag pairs from most to least strongly associated
function showTagPairs(tag_relationships) {
    var tag_array = [];
    for (var ts in tag_relationships) {
            tag_array.push([ts, tag_relationships[ts]]);
    }

    tag_array.sort(function (t1, t2) {
        return t2[1] - t1[1];
    });

    for (var i = 0; i < tag_array.length; i++) {
        console.log(tag_array[i][0], "-", tag_array[i][1]);
    }

    console.log("\n-------\n");
    console.log("Max tag count:", tag_array[0][1]);
    console.log("Median tag count:", tag_array[Math.floor(tag_array.length / 2)][1]);
    console.log("Min tag count:", tag_array[tag_array.length - 1][1]);
}


// My metric for how closely associated tags are is -simply- how
// frequently tags are referenced together on the same artist.
// This isn't the most sophisticated method ever, but I think it
// will be a good rough-approximation.

(function () {
    // First we will collect the top artists - assuming that more
    // people have spent time tagging and curating them.
    getTopArtists(NUM_ARTISTS, function (artists) {

        var tag_relationships = {};
        var outstanding_request_count = artists.length;

        // associateTags is a helper function that will take an artists
        // tags, generate pairs, and fill out tag_relationships
        function associateTags(artist, tags) {

            for (var i = 0; i < tags.length; i++) {
                for (var j = i + 1; j < tags.length; j++) {

                    // the tag_pair is sorted so that the pairs
                    // ["Rock", "Jazz"] and ["Jazz", "Rock"] will be
                    // counted properly
                    var tag_pair = [tags[i]['name'], tags[j]['name']].sort();
                    if (tag_relationships[tag_pair]) {
                        ++tag_relationships[tag_pair];
                    } else {
                        tag_relationships[tag_pair] = 1;
                    }

                }
            }

            // outstanding_request_count is something of a poor-man's
            // semaphore. Once it reaches 0 there are no outstanding
            // calls to get tags and we can display our results.
            --outstanding_request_count;
            if (outstanding_request_count <= 0) {
                showTagPairs(tag_relationships);
            }
        }

        // Here is where we actually make all of the api requests to get
        // top tags. Because we're keeping track of outstanding_request_count,
        // we can make all these requests roughly in parallel (as opposed to
        // chaining them one after the other)
        for (var i = 0; i < artists.length; i++) {
            getTopTags(artists[i]['name'], associateTags);
        }
    });
})();

console.log("Off and running! Computing tag associations for the top", NUM_ARTISTS, "artists...");
