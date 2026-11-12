// Capstone — raw-code reference solution for Practice World.
// The Block Studio reference project (examples/capstone-workflow.json)
// performs the same adventure with reusable blocks and a Group Block.
async function maybeBattle() {
  if (encounterActive()) await attack();
}

// 1) Talk to the NPC at (3, 8)
up(2);
right(1);
interact();

// 2) Back down and east along the road
down(2);
right(5);

// 3) North through the tall grass (column 7), resolve the encounter.
//    (Await movement before reading perception like encounterActive().)
up(6);
await right(1);
await maybeBattle();

// 4) East along row 3, read the sign from (10, 3)
up(1);
right(2);
interact();

// 5) Around the sign and on to the Lab approach at (16, 3)
down(1);
right(2);
up(1);
right(4);

say("Adventure automated. Destination reached: " + JSON.stringify(position()));
