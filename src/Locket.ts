import {
  fileToBuffer,
  getLocketMonsters,
  getProperty,
  print,
  setProperty,
  toInt,
  toMonster,
  Monster,
  printHtml,
  entityEncode,
  Location,
  getMonsters,
} from "kolmafia";

class MonsterInfo {
  monster: Monster;
  note: string;
}

class MonsterGroup {
  monsters: MonsterInfo[] = [];
  groupName: string;
}

class LocketMonsters {
  propertyName: string = "_locketMonstersSaved";
  propertyNameKnownToHave = "locketAmountKnownToHave";

  loadMonsters(): MonsterGroup[] {
    let buffer = fileToBuffer("locket_monsters.txt");

    let monsters: MonsterGroup[] = [];
    let alreadyProcessed: Monster[] = [];

    buffer.split(/(\n|\r)+/).forEach((line) => {
      line = line.trim();

      if (line.length == 0 || line.startsWith("#")) {
        return;
      }

      let spl = line.split("\t");
      let monster: Monster;

      try {
        monster = Monster.get(spl[0]);
      } catch {
        print("Invalid monster: " + spl[0], "red");
        return;
      }

      if (monster == null || monster == Monster.get("None")) {
        return;
      }

      if (!monster.copyable || monster.boss) {
        print(
          monster +
            " is marked as a boss or no-copy, yet is in locket_monsters.txt. Is this a mistake?",
          "gray"
        );
      }

      if (alreadyProcessed.includes(monster)) {
        print(
          "You have a duplicate entry for " +
            monster +
            " in your locket_monsters.txt"
        );
        return;
      }

      alreadyProcessed.push(monster);

      let monsterInfo = new MonsterInfo();
      monsterInfo.monster = monster;
      monsterInfo.note = (spl[2] || "").trim();

      let groupName = spl[1];

      if (groupName != null) {
        let group = monsters.find((group) => group.groupName == groupName);

        if (group != null) {
          group.monsters.push(monsterInfo);
          return;
        }
      }

      let group = new MonsterGroup();
      group.monsters.push(monsterInfo);
      group.groupName = groupName;

      monsters.push(group);
    });

    return monsters;
  }

  getLocketMonsters() {
    let locketMonsters: Monster[] = Object.keys(getLocketMonsters()).map((m) =>
      Monster.get(m)
    );

    let knownToHave = toInt(getProperty(this.propertyNameKnownToHave));

    // Add the fought
    for (let monster of getProperty("_locketMonstersFought")
      .split(",")
      .filter((m) => m.match(/[0-9]+/))
      .map((m) => toMonster(toInt(m)))) {
      if (locketMonsters.includes(monster)) {
        continue;
      }

      locketMonsters.push(monster);
    }

    let savedLocketMonsters: Monster[] = getProperty(this.propertyName)
      .split(",")
      .filter((m) => m.match(/[0-9]+/))
      .map((m) => toMonster(toInt(m)));

    for (let m of savedLocketMonsters) {
      if (locketMonsters.includes(m)) {
        continue;
      }

      locketMonsters.push(m);
    }

    if (locketMonsters.length > savedLocketMonsters.length) {
      setProperty(
        this.propertyName,
        locketMonsters.map((m) => toInt(m)).join(",")
      );
      setProperty(
        this.propertyNameKnownToHave,
        locketMonsters.length.toString()
      );
    } else {
      locketMonsters = savedLocketMonsters;
    }

    return locketMonsters;
  }

  printLocket(limit: number) {
    let wantToGet: MonsterGroup[] = this.loadMonsters();
    let alreadyKnow: Monster[] = this.getLocketMonsters();
    let knownToHave = toInt(getProperty(this.propertyNameKnownToHave));

    if (alreadyKnow.length < knownToHave) {
      print(
        "This is embarrassing.. Can't pull data on what locket monsters you own!",
        "red"
      );

      if (getProperty("_locketMonstersFought").split(",").length >= 3) {
        print(
          "You have already fought all 3 locket fights, unfortunately this means you can't load the monsters.. Wait for rollover?",
          "red"
        );
      } else {
        print(
          "Try visiting the locket remenise page then run this script again!",
          "gray"
        );
      }

      return;
    }

    let totalToGet: number = wantToGet.reduce(
      (p, v) => p + v.monsters.length,
      0
    );
    let unknown: MonsterGroup[] = wantToGet
      .map((group) => {
        let g = new MonsterGroup();
        g.groupName = group.groupName;

        for (let m of group.monsters) {
          if (alreadyKnow.includes(m.monster)) {
            continue;
          }

          g.monsters.push(m);
        }

        return g;
      })
      .filter((g) => g.monsters.length > 0);

    let totalUnknown: number = unknown.reduce(
      (p, v) => p + v.monsters.length,
      0
    );
    let totalKnown: number = totalToGet - totalUnknown;

    let monstersPrinted: number = 0;
    let linesPrinted: number = 0;

    let getLocations: (monster: Monster) => Location[] = function (
      monster: Monster
    ): Location[] {
      let locations: Location[] = [];

      for (let l of Location.all()) {
        if (!getMonsters(l).includes(monster)) {
          continue;
        }

        locations.push(l);
      }

      return locations;
    };

    let makeString: (string: String, monsterInfo: MonsterInfo) => string =
      function (string: String, monsterInfo: MonsterInfo) {
        let locationsTitle = "";
        let locations = getLocations(monsterInfo.monster);

        if (locations.length > 0) {
          let locationsStrings: string[] = locations.map(
            (l) => l.zone + ": " + l
          );

          locationsTitle = entityEncode(locationsStrings.join(", "));
        } else {
          locationsTitle = "No locations found";
        }

        if (monsterInfo.note.length > 0) {
          locationsTitle += " ~ Note: " + monsterInfo.note;
        }

        return (
          "<font color='gray' title='" +
          locationsTitle +
          "'>" +
          string +
          "</font>"
        );
      };

    print("Hover over the monsters to see locations");

    for (let group of unknown) {
      monstersPrinted += group.monsters.length;
      linesPrinted++;

      if (group.groupName == null) {
        for (let monster of group.monsters) {
          printHtml(
            makeString(
              monster.monster +
                (group.groupName != null ? " @ " + group.groupName : ""),
              monster
            )
          );
        }
      } else {
        printHtml(
          "<font color='blue'>" +
            group.groupName +
            ":</font> " +
            group.monsters
              .map((monster) => makeString(monster.monster + "", monster))
              .join(", ")
        );
      }

      if (linesPrinted >= limit && monstersPrinted + 1 < totalUnknown) {
        break;
      }
    }

    if (totalUnknown > monstersPrinted) {
      print(
        "Skipped " + (totalUnknown - monstersPrinted) + " monsters..",
        "gray"
      );
    }

    let totalMonsters: number = Monster.all().filter(
      (m) => m.copyable && !m.boss
    ).length;

    printHtml(
      `You have ${totalKnown} / ${totalToGet}. Including every monster <font title="The data on copyable monsters isn't always accurate.">possible*,</font> you have ${alreadyKnow.length} / ${totalMonsters}`
    );
  }
}

export function main(limit: string = "10") {
  new LocketMonsters().printLocket(toInt(limit));
}
