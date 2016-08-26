// Consider a Google sheet with two tabs. The first, named 'Meals', looks
// something like this:
//
//   +--------+-------------+------------------------------+----------------+
//   | Name   | Ingredients | Recipe                       | Link           |
//   +--------+-------------+------------------------------+----------------+
//   | Cereal | Milk        | Pour cereal into bowl. Then, | www.cereal.yum |
//   |        | Ceral       | add the milk. Eat with a     |                |
//   |        |             | spoon.                       |                |
//   +--------+-------------+------------------------------+----------------+
//   | Toast  | Bread       | Toast bread. Then, spread    |                |
//   |        | Butter      | on the butter. Eat with your |                |
//   |        |             | hands.                       |                |
//   +--------+-------------+------------------------------+----------------+
//   | ...    | ...         | ...                          | ...            |
//
// It contains a list of named meals, the ingredients needed for the meal,
// instructions on how to prepare the meal, and a link to the source of the
// recipe. The name column is required, but any of the other columns can be
// left blank.
//
// The second sheet, named 'Plans', looks something like this:
//
//   +-----------+--------------------------+
//   | Date      | Name                     |
//   +-----------+--------------------------+
//   | 8/20/2016 | Toast                    |
//   | 8/21/2016 | Cereal                   |
//   | 8/22/2016 | Filet mignon with caviar |
//   | 8/23/2016 |                          |
//   | 8/24/2016 |                          |
//   | 8/25/2016 |                          |
//   |           |                          |
//   |           |                          |
//   | ...       | ...                      |
//
// It contains a list of dated meals where the value of the Meal column may
// (e.g. Toast, Cereal) or may not (e.g. Filet mignon with caviar) reference a
// meal in the Meals sheet. Note that there may be a contiguous block of rows
// with dates but no names at the bottom of the sheet.
//
// This file authorizes the use of the Google Sheets API, parses the data in
// the two sheets, and organizes the recipes into a handful of pretty looking
// Boostrap-formatted cards which are displayed on the website.
//
// Most of the authorization code is taken verbatim from
// https://developers.google.com/sheets/quickstart/js. Most of the card
// creation and formatting code is taken verbatime from
// http://v4-alpha.getbootstrap.com/components/card/.

////////////////////////////////////////////////////////////////////////////////
// Globals
////////////////////////////////////////////////////////////////////////////////
// The Google OAuth client ID taken from the Google Developer Console. See
// https://developers.google.com/sheets/quickstart/js for more information.
var CLIENT_ID =
    '914383398331-h1kgd8vo8309oopspa7mfvmm4dq38963.apps.googleusercontent.com';

// See https://developers.google.com/sheets/quickstart/js for more information.
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// The id of the Meals spreadsheet, the schema of which is described above.
var SPREADSHEET_ID = '1bUxCWSuXtUMBL4nVDyZUVubpHFnAyRddxbvBQnsyXFc'

////////////////////////////////////////////////////////////////////////////////
// Google Sheets API Authorization
////////////////////////////////////////////////////////////////////////////////
// Check if current user has authorized this application.
function checkAuth() {
    gapi.auth.authorize({
        'client_id': CLIENT_ID,
        'scope': SCOPES.join(' '),
        'immediate': true
    }, handleAuthResult);
}

// Handle response from authorization server.
function handleAuthResult(authResult) {
    var authorizeDiv = document.getElementById('authorize-div');
    if (authResult && !authResult.error) {
        // Hide auth UI, then load client library.
        authorizeDiv.style.display = 'none';
        loadSheetsApi();
    } else {
        // Show auth UI, allowing the user to initiate authorization by
        // clicking authorize button.
        authorizeDiv.style.display = 'inline';
    }
}

// Initiate auth flow in response to user clicking authorize button.
function handleAuthClick(event) {
    gapi.auth.authorize({
        'client_id': CLIENT_ID,
        'scope': SCOPES.join(' '),
        'immediate': false
    }, handleAuthResult);
    return false;
}

/** Load Sheets API client library. */
function loadSheetsApi() {
    var discoveryUrl =
        'https://sheets.googleapis.com/$discovery/rest?version=v4';
    gapi.client.load(discoveryUrl).then(populateSite);
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////
// Create a DOM element of type 'element_type' with attributes described in the
// 'attributes' dictionary and optionally with inner HTML 'innerHTML'. For
// example, this invocation:
//
//   createElement('div', {
//      'class': 'alert alert-danger',
//      'role': 'alert',
//   }, "Error");
//
// will construct the following div:
//
//   <div class="alert alert-danger" role="alert">
//      Error
//   </div>
function createElement(element_type, attributes, innerHtml) {
    var element = document.createElement(element_type);
    for (var key in attributes) {
        element.setAttribute(key, attributes[key]);
    }
    if (innerHtml !== undefined) {
        element.appendChild(document.createTextNode(innerHtml));
    }
    return element;
}

// Create a fancy error box with message 'message' and append it to the site.
// The error uses the following Bootstrap HTML:
//
//   <div class="alert alert-danger" role="alert">
//     Error message.
//   </div>
function createAlert(message) {
    var container = document.getElementById('container');
    container.appendChild(createElement('div', {
        'class': 'alert alert-danger',
        'role': 'alert',
    }, message));
}


////////////////////////////////////////////////////////////////////////////////
// Data Parsing and Card Creation
////////////////////////////////////////////////////////////////////////////////
// Populate the meal planning website which involves a couple of steps:
//   (1) Load the list of meals from the Meals tab.
//   (2) Load the list of planned meals from the Plans tab.
//   (3) Create and insert the recipe cards into the site.
function populateSite() {
    // Read data from the Meals sheet.
    gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Meals!A2:D',
    }).then(processMeals,
       function(response) { createAlert(response.result.error.message); }
    );
}

// Parses and formats the data in the Meals tab into a dictionary mapping meal
// names to meal objects. The example data at the top of the file would produce
// the following meals dictionary:
//
//   {
//     "Cereal": {
//       "name": "Cereal",
//       "ingredients": ["Milk", "Cereal"],
//       "recipe": "Pour cereal ...",
//       "link": "www.cereal.yum"
//     },
//     "Toast": {
//       "name": "Toast",
//       "ingredients": ["Bread", "Butter"],
//       "recipe": "Toast bread. Then, ...",
//       "link": undefined
//     }
//   }
//
// Note that if any column is missing, it is left undefined.
function processMeals(response) {
    meals = {}
    var range = response.result;
    for (i = 0; i < range.values.length; i++) {
        var row = range.values[i];
        meal = {
            "name": row[0],
            "ingredients": row[1] === undefined ? undefined : row[1].split('\n'),
            "recipe": row[2],
            "link": row[3],
        }
        meals[meal.name] = meal
    }

    // Read data from the Plans sheet.
    gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Plans!A2:B',
    }).then(function(response) {
        processPlannedMeals(meals, response);
    }, function(response) {
        createAlert(response.result.error.message);
    });
}

// Parse and format the data in the Plans tab into a list of planned meal
// objects. Meals are grouped in sevens, one for each day of the week. The most
// recent week is first, the oldest week is last. The example data at the top
// of the file would produce the following planned meals list:
//
//   [
//     [
//       { date: "8/20/2016", name: "Toast" },
//       { date: "8/21/2016", name: "Cereal" },
//       { date: "8/22/2016", name: "Filet mignon with caviar" }
//     ]
//   ]
//
// 'meals' is the meals dictionary created by 'processMeals'.
function processPlannedMeals(meals, response) {
    planned_meals = [];
    var meals_per_week = 7;
    var range = response.result;
    for (i = 0; i < range.values.length; i++) {
        var row = range.values[i];
        planned_meal = {
            "date": row[0],
            "name": row[1]
        }

        // If there is a meal date but no name, then we've hit the contiguous
        // block of rows with no names. We will not include those in the
        // website, so we break here.
        if (planned_meal.name === undefined) {
            break;
        }

        if (i % meals_per_week === 0) {
            planned_meals.unshift([]);
        }
        planned_meals[0].push(planned_meal);
    }

    createCards(meals, planned_meals);
}

// Creates the meal cards from the 'meals' dictionary and 'planned_meals' list
// created by processMeals and processPlannedMeals respectively. Cards are
// grouped by week and columnated. Each week is delimited by a heading. For
// example,
//
//   Week 2
//   ======
//
//   +-----------+  +-----------+  +-----------+
//   | Monday    |  | Tuesday   |  | Wednesday |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   +-----------+  +-----------+  +-----------+
//   +-----------+  +-----------+  +-----------+
//   | Thursday  |  | Friday    |  | Saturday  |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   |           |  |           |  |           |
//   +-----------+  +-----------+  +-----------+
//   +-----------+
//   | Sunday    |
//   |           |
//   |           |
//   |           |
//   |           |
//   |           |
//   |           |
//   +-----------+
//
//   Week 1
//   ======
//
//   +-----------+  +-----------+  +-----------+
//   | Monday    |  | Tuesday   |  | Wednesday |
//   |           |  |           |  |           |
//   ...
function createCards(meals, planned_meals) {
    // All cards are added the cards div.
    var cards = document.getElementById('cards');

    for (i = 0; i < planned_meals.length; i++) {
        var week_meals = planned_meals[i];

        // Week header.
        var week_number = planned_meals.length - i;
        cards.appendChild(createElement("h2", {}, "Week " + week_number));

        // Cards are columnated into card groups where each card group includes
        // a bunch of cards organized in columns. Not every week has a complete
        // set of meals, so not every week uses the same number of groups.
        //
        //   +-----+ +-----+ +-----+ .
        //   |     | |     | |     |  \
        //   |     | |     | |     |   | Group 0
        //   |     | |     | |     |  /
        //   +-----+ +-----+ +-----+ '
        //   +-----+ +-----+ +-----+ .
        //   |     | |     | |     |  \
        //   |     | |     | |     |   | Group 1
        //   |     | |     | |     |  /
        //   +-----+ +-----+ +-----+ '
        //   +-----+                 .
        //   |     |                  \
        //   |     |                   | Group 2
        //   |     |                  /
        //   +-----+                 '
        //
        var cards_per_group = 2;
        var number_of_groups = Math.ceil(week_meals.length / cards_per_group);
        var groups = [];
        for (j = 0; j < number_of_groups; j++) {
            groups.push(createElement('div', {'class': 'card-deck'}));
        }

        for (j = 0; j < week_meals.length; j++) {
            var planned_meal = week_meals[j];
            var meal = meals[planned_meal.name];

            // Cards look like this:
            //
            //   <div class="card">
            //     <div class="card-block">
            //       <h4 class="card-title">Title </h4>
            //       <h2 class="card-subtitle">Subtitle </h2>
            //     </div>
            //     <div class="card-block">
            //       <p class="card-text">Body 1</p>
            //       <p class="card-text">Body 2</p>
            //     </div>
            //   </div>
            var card = createElement('div', {'class': 'card'});
            var group = groups[Math.floor(j / cards_per_group)];
            group.appendChild(card);

            // Name (title) and date (subtitle).
            var cardTitleBlock = createElement('div', {
                'class': 'card-block card-inverse card-primary'
            });
            card.appendChild(cardTitleBlock)
            var cardTitle = createElement('h4', {
                'class': 'card-title'
            }, planned_meal.name);
            cardTitleBlock.appendChild(cardTitle);
            var cardSubTitle = createElement('h6', {
                'class': 'card-subtitle'
            }, planned_meal.date);
            cardTitleBlock.appendChild(cardSubTitle);

            // Ingredients.
            if (meal && meal.ingredients !== undefined) {
                var ingredients = createElement('ul', {
                    'class': 'list-group list-group-flush'
                });
                card.appendChild(ingredients);

                for (k = 0; k < meal.ingredients.length; k++) {
                    ingredients.appendChild(createElement('li', {
                        'class': 'list-group-item'
                    }, meal.ingredients[k]));
                }
            }

            // Recipe.
            if (meal && meal.recipe !== undefined) {
                var cardRecipeBlock = createElement('div', {
                    'class': 'card-block'
                });
                card.appendChild(cardRecipeBlock);

                cardRecipeBlock.appendChild(createElement('p', {
                    'class': 'card-text'
                }, meal.recipe));
            }

            // Link.
            if (meal && meal.link !== undefined) {
                var cardLinkBlock = createElement('div', {
                    'class': 'card-block'
                });
                card.appendChild(cardLinkBlock);

                cardLinkBlock.appendChild(createElement('a', {
                    'class': 'card-link',
                    'href': meal.link
                }, 'Source'));
            }
        }

        var cardDeckWrapper = createElement("div", {
            'class': 'card-deck-wrapper'
        });
        cards.appendChild(cardDeckWrapper);
        for (j = 0; j < groups.length; j++) {
            cardDeckWrapper.appendChild(groups[j]);
        }
    }
}
