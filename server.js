var css = require('css'),
  express    = require('express'),
  bodyParser = require('body-parser'),
  swig = require('swig'),
  request = require('request');

var app = express()

// parse application/json
app.use(bodyParser.json());

// This is where all the magic happens!
app.engine('scss', swig.renderFile);
app.engine('html', swig.renderFile);

app.set('view engine', 'html');
app.set('views', __dirname + '/templates');

function toIonic1Theme(req, res, theme) {
  res.render('ionic1.theme.scss', theme, function(err, d) {
    res.json({
      v: '1',
      theme: d
    });
  });
}
function toIonic2Theme(req, res, theme) {
  res.render('ionic2.app.variables.scss', theme, function(err, d) {
    res.json({
      v: '2',
      theme: d
    });
  });
}

function bootstrapThemeNameToIonic2(name) {
  return {
    'primary': 'primary',
    'default': 'secondary',
    'danger': 'danger',
  }[name] || name;
}
function bootstrapThemeNameToIonic1(name) {
  return {
    'primary': 'positive',
    'success': 'balanced',
    'default': 'stable',
    'info': 'calm',
    'warning': 'energized',
    'danger': 'assertive'
  }[name] || name;
}


function addButtonColor(theme, rule, color, v) {
  theme['buttons'] = theme['buttons'] || {};

  var ionicThemeName = v == '2' ? bootstrapThemeNameToIonic2(color) : bootstrapThemeNameToIonic1(color);

  var backgrounds = {};
  var foregrounds = {};

  var d;
  for(var i = 0; i < rule.declarations.length; i++) {
    d = rule.declarations[i];
    if(d.property == 'background-color') {
      backgrounds[ionicThemeName] = d.value;
    }
    if(d.property == 'color') {
      foregrounds[ionicThemeName] = d.value
    }
  }

  for(var b in backgrounds) {
    var fg = foregrounds[b];
    var bg = backgrounds[b];

    theme.buttons[b] = {
      key: ionicThemeName,
      contrast: fg,
      color: bg
    };
  }
}

function isBootstrapButtonThemeSelector(sel) {
  return !!{
    '.btn-primary': true,
    '.btn-success': true,
    '.btn-default': true,
    '.btn-info': true,
    '.btn-warning': true,
    '.btn-danger': true,
  }[sel];
}

function parseBootstrap(req, res, cssString, v, cb) {
  var p;
  try {
    p = css.parse(cssString, {});
  } catch(e) {
    console.error('Unable to parse', e);
    res.status(400).json({
      status: 'error',
      reason: 'bad_parse'
    })
    return;
  }

  if(!p.type || p.stylesheet.parsingErrors.length) {
    res.status(400).json({
      status: 'error',
      parsingErrors: p.stylesheet.parsingErrors
    });
    return;
  }

  var theme = {};

  var rules = p.stylesheet.rules.filter(function(r) {
    return r.type == 'rule';
  });

  var rule, sels, s, selectorIndex, color;

  for(var i = 0; i < rules.length; i++) {
    rule = rules[i];
    //console.log("RULE", rule);
    sels = rule.selectors;
    for(var j = 0; j < sels.length; j++) {
      s = sels[j];
      if((selectorIndex = s.indexOf('.btn-')) == 0) {
        if(isBootstrapButtonThemeSelector(s)) {
          color = s.slice(selectorIndex + '.btn-'.length);
          addButtonColor(theme, rule, color, v);
        }
      }
    }
  }

  cb(theme);
}

app.post('/api/v1/parse-bootstrap-url', function(req, res) {
  console.log('Got body', req.body);

  var v = req.body.v || '2';

  request(req.body.url, function(err, response, body) {
    if(err) {
      res.status(400).json({
        status: 'error',
        reason: 'request_error',
        data: err
      });
      return;
    }

    parseBootstrap(req, res, body, v, function(theme) {
      if(v == '1') {
        toIonic1Theme(req, res, theme);
      } else {
        toIonic2Theme(req, res, theme);
      }
    });
  })
});

app.get('/', function(req, res) {
  res.render('index.html')
});

app.use('/static', express.static('static'));

app.listen(process.env.PORT || 3000, function () {
  console.log('Example app listening on port 3000!');
});
