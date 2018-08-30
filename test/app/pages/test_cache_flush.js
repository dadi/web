<ul>${typeof car_makes_unchained !== 'undefined'
    ? car_makes_unchained.results.map(c => `<li>${c.makeName}</li>`).join('')
    : ''}</ul>