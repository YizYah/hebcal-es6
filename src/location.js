/*
    Hebcal - A Jewish Calendar Generator
    Copyright (c) 1994-2020 Danny Sadinoff
    Portions copyright Eyal Schachter and Michael J. Radwin

    https://github.com/hebcal/hebcal-es6

    This program is free software; you can redistribute it and/or
    modify it under the terms of the GNU General Public License
    as published by the Free Software Foundation; either version 2
    of the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import suncalc from "suncalc";

suncalc.addTime(-16.1, "alot_hashachar", 0);
suncalc.addTime(-11.5, "misheyakir", 0);
suncalc.addTime(-10.2, "misheyakir_machmir", 0);
suncalc.addTime(-8.5, 0, "tzeit");

export default class Location {
  constructor(latitude, longitude, il, tzid, cityName, countryCode, geoid) {
    this.latitude = +latitude;
    this.longitude = +longitude;
    this.il = Boolean(il);
    this.tzid = tzid;
    this.name = cityName;
    this.cc = countryCode;
    this.geoid = geoid;
  }

  suntime(hdate) {
    // reset the date to midday before calling suncalc api
    // https://github.com/mourner/suncalc/issues/11
    const date = hdate.greg();
    return suncalc.getTimes(
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0, 0),
      this.latitude,
      this.longitude
    );
  }

  sunrise(hdate) {
    return this.suntime(hdate).sunrise;
  }

  sunset(hdate) {
    return this.suntime(hdate).sunset;
  }

  hour(hdate) {
    const st = this.suntime(hdate);
    return (st.sunset - st.sunrise) / 12; // ms in hour
  }

  hourMins(hdate) {
    // hour in ms / (1000 ms in s * 60 s in m) = mins in halachic hour
    return this.hour(hdate) / (1000 * 60);
  }

  gregEve(hdate) {
    return this.sunset(hdate.prev());
  }

  nightHour(hdate) {
    return (this.sunrise(hdate) - this.gregEve(hdate)) / 12; // ms in hour
  }

  nightHourMins(hdate) {
    // hour in ms / (1000 ms in s * 60 s in m) = mins in halachic hour
    return this.nightHour(hdate) / (1000 * 60);
  }

  static newFromCity(city) {
    return new Location(city.latitude, city.longitude, city.cc == 'IL',
      city.tzid, city.name, city.cc, city.geoid);
  }
}

/*
function hourOffset(hdate, hours) {
    return new Date(hdate.sunrise()[getTime]() + (hdate[hour]() * hours));
}

const zemanim = {
    chatzot(hdate) {
        return hourOffset(hdate, 6);
    },
    chatzot_night(hdate) {
        return new Date(hdate.sunrise().getTime() - (hdate.nightHour() * 6));
    },
    alot_hashachar(hdate) {
        return suntime(hdate).alot_hashachar;
    },
    alot_hashacher(hdate) {
        return suntime(hdate).alot_hashachar;
    },
    misheyakir(hdate) {
        return suntime(hdate).misheyakir;
    },
    misheyakir_machmir(hdate) {
        return suntime(hdate).misheyakir_machmir;
    },
    sof_zman_shma(hdate) { // Gra
        return hourOffset(hdate, 3);
    },
    sof_zman_tfilla(hdate) { // Gra
        return hourOffset(hdate, 4);
    },
    mincha_gedola(hdate) {
        return hourOffset(hdate, 6.5);
    },
    mincha_ketana(hdate) {
        return hourOffset(hdate, 9.5);
    },
    plag_hamincha(hdate) {
        return hourOffset(hdate, 10.75);
    },
    tzeit(hdate) {
        return suntime(hdate).tzeit;
    },
    neitz_hachama(hdate) {
        return hdate.sunrise();
    },
    shkiah(hdate) {
        return hdate.sunset();
    }
};

*/