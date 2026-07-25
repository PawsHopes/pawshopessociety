/* ==========================================================================
   Paws Hopes Society — Adoption Data
   ==========================================================================
   Edit the two arrays below to add, remove, or update animals. No other
   file needs to change — adopt.html automatically renders cards from
   whatever is listed here.

   HOW TO ADD AN ANIMAL
   ---------------------
   Copy this template into the correct array and fill in the details:

   {
     name: "Rocky",                          // Animal's name
     species: "Dog",                         // Dog / Cat / Monkey / Bird / Squirrel / Guinea Pig
     gender: "Male",                         // Male / Female
     age: "Approx. 1 year",                  // Best estimate is fine
     photo: "assets/images/adoption/rocky.jpg", // Path to a photo you've uploaded into that folder
                                              // Leave as "" (empty string) if you don't have a photo yet —
                                              // the page will show a placeholder automatically.
     description: "Friendly, house-trained, good with children. Rescued after a road accident and fully recovered."
   },

   Add real photo files into: assets/images/adoption/
   Then reference the filename in the "photo" field above.

   Once an animal is adopted, cut its entry from AVAILABLE_FOR_ADOPTION
   and paste it into ADOPTED_ANIMALS below (you can add an "adoptedNote"
   field with a short happy update if you like).
   ========================================================================== */

window.AVAILABLE_FOR_ADOPTION = [
  // Add real animals currently looking for a home here.
  // Example (remove the leading // on each line to activate):
  // {
  //   name: "Example",
  //   species: "Dog",
  //   gender: "Female",
  //   age: "Approx. 2 years",
  //   photo: "",
  //   description: "Add a short, honest description here."
  // },
];

window.ADOPTED_ANIMALS = [
  // Move an animal here once it has found its forever home.
  // Example:
  // {
  //   name: "Example",
  //   species: "Cat",
  //   gender: "Male",
  //   age: "Approx. 1 year",
  //   photo: "",
  //   description: "Add a short, honest description here.",
  //   adoptedNote: "Now living happily with a loving family!"
  // },
];
