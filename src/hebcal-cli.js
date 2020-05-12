import cities from './cities';
import Location from './location';
import hebcal from './hebcal';

cities.init();
const loc = Location.newFromCity(cities.getCity("San Francisco"));
const options = {
    location: loc,
    year: 2020,
/*
    year: 5780,
    isHebrewYear: true,
    month: "Iyyar",
*/
    candlelighting: true,
    sedrot: true,
    noModern: false,
    noMinorFast: false,
    noRoshChodesh: false,
    noSpecialShabbat: false,
    noHolidays: false,
    dafyomi: false,
    omer: true,
};

const dateFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: loc.tzid,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
});

const events = hebcal.hebcalEvents(options);
for (const e of events) {
    const gregDt = e.getDate().greg();
    const gregDtStr = dateFormat.format(gregDt);
    console.log(gregDtStr, e.getDesc());
}
