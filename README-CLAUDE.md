You are a senior full-stack engineer and UI/UX designer. Build a complete, production-ready family tree web application that runs in a browser, can be stored in a GitHub repository, and can be deployed publicly on the internet.

# Project goal

Create an interactive family tree website where I can display a very large family beginning with an original couple. Each person must have a visual card showing their basic information, gender, relationship, and optional photo.

The final application must work as a normal website in Chrome, Firefox, Safari, Edge, desktop, tablet, and mobile browsers.

The project must be easy to deploy using GitHub and Vercel. It should also support deployment to GitHub Pages if technically practical.

# Required technology

Use:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Flow for the interactive family tree
- Lucide React for icons
- Local JSON or TypeScript data files for the first version
- LocalStorage for saving edits in the browser
- No paid services
- No backend required for version 1
- No API keys
- No Firebase
- No Supabase
- No authentication service

Use the latest stable compatible package versions.

# Main application requirements

## 1. Interactive family tree

Create a large interactive family tree that supports:

- Parent and child connections
- Married or partnered couples
- Multiple generations
- Multiple children
- Siblings
- Male and female visual indicators
- Unknown or unspecified gender option
- Deceased family members
- Optional profile photos
- Large families with at least 200 people
- Zooming
- Panning
- Fit-to-screen
- Centering the tree
- Expand and collapse branches
- Smooth animations
- Clear relationship lines
- Responsive layout

The tree should begin with an original couple at the top. Their children should appear below them, followed by grandchildren and future generations.

Spouses should appear next to each other.

Children should appear underneath their parents.

The layout must remain understandable even when the family becomes very large.

## 2. Person cards

Each family member should be displayed in a polished card.

Each card should support:

- Profile photo
- Default male avatar
- Default female avatar
- Default neutral avatar
- Full name
- Nickname
- Gender
- Birth date
- Birth year
- Age calculated automatically
- Death date
- Current age or age at death
- City
- Country
- Occupation
- Short biography
- Relationship label
- Generation number
- Living or deceased status
- Number of children

Use different visual indicators for:

- Male
- Female
- Neutral or unspecified
- Deceased

Do not depend only on color. Use icons, text, borders, and badges for accessibility.

When a card is clicked, open a details panel or modal containing all available information about that person.

## 3. Add and edit family members

Create an admin/edit mode inside the website.

It must allow me to:

- Add a new person
- Edit an existing person
- Delete a person
- Add a spouse
- Add a parent
- Add a child
- Add a sibling
- Upload or select a profile photo
- Choose gender
- Enter birth and death dates
- Enter city and country
- Enter occupation
- Enter biography
- Mark someone as deceased
- Change relationships
- Confirm before deleting
- Validate required fields
- Prevent impossible relationships
- Prevent duplicate IDs
- Prevent a person from becoming their own parent, spouse, or child

Use browser LocalStorage to save edits so they remain after refreshing the page.

Include buttons to:

- Save changes
- Cancel
- Reset to sample data
- Export family data
- Import family data

## 4. Import and export

Create working import and export features.

The user must be able to:

- Export the complete family tree as a JSON file
- Import a family tree from a JSON file
- Validate imported data
- Show an error message for invalid JSON
- Confirm before replacing existing data
- Download a backup
- Reset the website to the original sample data

Also include an option to export the visible family tree as a PNG image if reasonably possible using a reliable browser-compatible package.

If PNG export becomes unstable, prioritize JSON export and leave a clearly documented extension point for PNG or PDF export.

## 5. Search and filtering

Add a search bar that can find a person by:

- Full name
- Nickname
- City
- Country
- Occupation

When a result is selected:

- Expand the necessary family branches
- Center the selected person on screen
- Highlight their card
- Open their details if requested

Add filters for:

- Gender
- Living
- Deceased
- Generation
- Country

Add a button to clear all filters.

## 6. Family statistics

Create a statistics dashboard showing:

- Total family members
- Total living members
- Total deceased members
- Number of generations
- Number of men
- Number of women
- Number of unspecified members
- Number of countries represented
- Number of cities represented
- Oldest living member
- Youngest living member
- Average age when enough data exists
- Largest number of children
- Family member with the most descendants

The statistics must update automatically when data changes.

## 7. Privacy mode

Include privacy controls.

Create a public privacy mode that can hide:

- Exact birth dates
- Exact death dates
- Ages of minors
- Cities
- Occupations
- Biographies
- Profile photos

Add a settings panel with switches for these options.

Include a visible message explaining that public family websites should not expose sensitive personal information.

Do not include addresses, phone numbers, email addresses, legal documents, or other highly sensitive information in the sample data.

## 8. Design

Create a clean, modern, premium design.

Style requirements:

- Professional landing page
- Elegant family-tree theme
- Modern typography
- Spacious layout
- Soft shadows
- Rounded cards
- Smooth transitions
- Clear visual hierarchy
- Light mode
- Dark mode
- Theme toggle
- Mobile-friendly navigation
- Accessible buttons and forms
- Good contrast
- Keyboard navigation
- Visible focus states
- Loading and empty states
- Toast notifications
- Confirmation dialogs

Do not make it look like a basic school project.

Use a tasteful tree, roots, generations, or ancestry visual concept without making the interface cluttered.

## 9. Pages and sections

Create the following routes or sections:

### Home page

Include:

- Project name
- Short family description
- “Explore Family Tree” button
- Family summary statistics
- Featured oldest couple
- Privacy notice

### Family Tree page

Include:

- Interactive React Flow tree
- Search
- Filters
- Zoom controls
- Fit view
- Expand all
- Collapse all
- Edit mode
- Add person button
- Export and import controls

### Family Members page

Display all family members in a responsive card or table view.

Support:

- Search
- Sorting
- Filtering
- Open details
- Edit
- Delete

Sorting options should include:

- Name
- Age
- Birth year
- Generation
- Number of children

### Statistics page

Display all calculated family statistics using cards and simple charts.

Do not use complicated chart libraries unless necessary. CSS-based charts are acceptable.

### About page

Explain:

- The purpose of the family tree
- How family information is organized
- Privacy considerations
- How to contribute updates

### Settings page

Include:

- Theme
- Privacy controls
- Reset sample data
- Export backup
- Import backup
- Data management

## 10. Sample data

Include realistic sample data containing at least 25 fictional family members across at least four generations.

The sample family must include:

- An original married couple
- Several children
- Spouses
- Grandchildren
- Great-grandchildren
- Living and deceased members
- Different cities and countries
- Male, female, and unspecified examples
- Optional photos using local placeholders or generated initials

Do not use real people.

Structure the data so I can easily replace sample people with my own family members.

Create a clear data model.

Suggested structure:

```ts
type Gender = 'male' | 'female' | 'unspecified';

interface FamilyPerson {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  isDeceased: boolean;
  photo?: string;
  city?: string;
  country?: string;
  occupation?: string;
  biography?: string;
  parentIds: string[];
  spouseIds: string[];
  childIds: string[];
  generation?: number;
}
```

Improve this model where necessary.

Relationships must remain synchronized. For example:

- If Person A is added as Person B’s spouse, Person B should also become Person A’s spouse.
- If Person A is added as Person B’s parent, Person B should automatically become Person A’s child.

Create relationship utility functions and validation.

## 11. Architecture and code quality

Use a clean project structure such as:

```text
src/
  components/
  pages/
  features/
  hooks/
  context/
  data/
  types/
  utils/
  services/
  assets/
```

Requirements:

- Reusable components
- Strict TypeScript
- No unnecessary `any`
- Clear interfaces and types
- Clean state management
- React Context or Zustand if needed
- Error boundaries
- Form validation
- Helpful comments only where needed
- No dead code
- No fake buttons
- No unfinished core features
- No console errors
- No broken imports
- No hardcoded absolute computer paths
- No exposed secrets
- No server dependency

Use ESLint and Prettier.

## 12. Browser storage

Use LocalStorage to save:

- Family member data
- Theme preference
- Privacy settings
- Collapsed branches
- Application preferences

Create safe parsing and fallback behavior if LocalStorage contains corrupted data.

Add a version field so future data migrations are possible.

## 13. Deployment

The finished project must be deployable publicly.

Configure it for:

### Vercel

Include:

- Correct Vite configuration
- SPA routing support
- A `vercel.json` file if required
- Production build command
- Output directory configuration

Expected Vercel settings:

```text
Build command: npm run build
Output directory: dist
```

### GitHub

Create:

- `.gitignore`
- `README.md`
- Clear commit-ready repository
- No `node_modules`
- No secrets
- No local environment files unless documented

### GitHub Pages

Also configure GitHub Pages deployment if practical.

Add a GitHub Actions workflow at:

```text
.github/workflows/deploy.yml
```

The workflow should:

- Install dependencies
- Run lint
- Run TypeScript checks
- Build the project
- Deploy the `dist` folder to GitHub Pages

Configure Vite’s base path correctly for GitHub Pages.

Document how to change the repository name or base path.

If supporting both Vercel and GitHub Pages creates routing conflicts, prioritize Vercel deployment and explain the GitHub Pages configuration clearly.

## 14. Required npm scripts

Include working scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "format": "prettier --write ."
}
```

Adjust them where required, but all scripts must work.

## 15. README requirements

Create a complete `README.md` containing:

- Project overview
- Screenshot section
- Features
- Technology stack
- Installation
- Running locally
- Building for production
- How to edit family data
- How to use the admin interface
- How to import and export JSON
- How to deploy to Vercel
- How to deploy to GitHub Pages
- How to push the project to GitHub
- Privacy warning
- Troubleshooting
- Future improvements

Include these Git commands:

```bash
git init
git add .
git commit -m "Initial family tree web app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Explain that I must replace `YOUR_USERNAME` and `YOUR_REPOSITORY`.

## 16. Testing and verification

Before declaring the project complete:

1. Install all dependencies.
2. Run the development server.
3. Run ESLint.
4. Run TypeScript checking.
5. Run the production build.
6. Fix every build error.
7. Fix every TypeScript error.
8. Fix important lint errors.
9. Confirm there are no missing imports.
10. Confirm browser refresh works on deployed routes.
11. Confirm LocalStorage saves changes.
12. Confirm importing and exporting JSON works.
13. Confirm the tree works on mobile.
14. Confirm dark mode works.
15. Confirm search and filters work.
16. Confirm adding, editing, and deleting people works.
17. Confirm relationships stay synchronized.
18. Confirm invalid relationships are rejected.
19. Confirm the production `dist` folder is generated.
20. Confirm the repository is ready to push to GitHub.

Do not tell me that something works unless you actually verify it.

## 17. Final response

After completing the project, provide:

- A concise summary of what was built
- The final project structure
- Commands to run it locally
- Commands to push it to GitHub
- Exact Vercel deployment steps
- Exact GitHub Pages deployment steps
- Any limitations
- A list of important files I should edit to replace the sample family with my real family

Do not stop after generating an outline. Create the actual application and all required files.

Do not create only a visual mockup.

Do not leave placeholder core functions.

Do not require me to manually write missing code.

Make the application fully functional, polished, production-ready, deployable, and usable in a public browser through an internet link.
