# Menu Copy Functionality

## Overview
The menu management system now includes enhanced functionality to copy menu items from one date to another, making it easier to plan menus and reuse successful meal plans. The system supports copying from any date (including past dates) to any other date with an improved user interface. **Nutrition data and status are fully preserved during copy operations.**

## Features

### 1. Copy to Next Date
- **Location**: Individual menu date view (`/admin/menu/date/:date`)
- **Button**: "📋 Copy to Next Date" (blue button)
- **Functionality**: Automatically copies all menu items from the current date to the next day
- **Availability**: Only shown when there are menu items present and the date is not read-only

### 2. Copy to Specific Date
- **Location**: Individual menu date view (`/admin/menu/date/:date`)
- **Button**: "📅 Copy to Date" (yellow button)
- **Functionality**: Allows copying menu items to any specific future date
- **Availability**: Only shown when there are menu items present and the date is not read-only

### 3. Copy from Menu Table
- **Location**: Menu overview table (`/admin/menu`)
- **Button**: "📋 Copy" button in the actions column
- **Functionality**: Allows copying menu items from any date to any other date
- **Availability**: Available for all dates with menu items (including past dates)

## How It Works

### Backend API
- **Endpoint**: `POST /admin/menu/copy`
- **Required Parameters**:
  - `fromDate`: Source date (YYYY-MM-DD format)
  - `toDate`: Target date (YYYY-MM-DD format)
- **Validation**:
  - Both dates are required
  - Target date must not already have menu items
  - Source date must have menu items to copy
  - **Note**: Copying to past dates is now allowed with user confirmation

### Copy Process
1. Retrieves all menu items from the source date
2. Validates that the target date is empty
3. Creates new menu items with the same data but new date
4. Preserves all item properties including:
   - Name
   - Category
   - Description
   - Nutritional information (complete with status)
   - Nutrition status (pending/completed)
   - Nutrition metadata (added by, added at)
   - Active status

### Error Handling
- **400**: Missing required parameters
- **400**: No menu items found for source date
- **409**: Target date already has menu items
- **500**: Server error during copy process

## User Experience

### Copy to Next Date
1. User clicks "📋 Copy to Next Date" button
2. Confirmation dialog shows source and target dates
3. If confirmed, items are copied
4. Success message shows number of items copied
5. Option to view the copied menu for the next date

### Copy to Specific Date
1. User clicks "📅 Copy to Date" button
2. Enhanced modal opens with:
   - Source date information
   - Item count display
   - Date picker for target date
   - Copy options (nutrition data, descriptions)
   - Warning for past dates
3. User selects target date and options
4. Confirmation with loading state
5. Copy process with success/error feedback
6. Option to view copied menu

### Copy from Menu Table
1. User clicks "📋 Copy" button in the menu table
2. Enhanced modal opens with:
   - Source date information
   - Date picker for target date (defaults to tomorrow)
   - Copy options (nutrition data, descriptions)
   - Warning for past dates
3. User selects target date and options
4. Confirmation with loading state
5. Copy process with success/error feedback
6. Option to view copied menu or refresh table

## Technical Implementation

### Frontend
- Enhanced modal interface in both `views/admin/menu-date.ejs` and `views/admin/menu-table.ejs`
- JavaScript functions:
  - **Menu Date View** (`public/js/menu-date.js`):
    - `copyToNextDate(selectedDate)`: Copies to next day
    - `copyToSpecificDate(selectedDate)`: Copies to user-specified date
    - `showCopyModal(sourceDate, defaultTargetDate)`: Shows enhanced copy modal
    - `executeCopy()`: Handles copy operation with loading states
    - `checkExistingItems()`: Validates target date
  - **Menu Table View** (`views/admin/menu-table.ejs`):
    - `copyMenu(dateStr)`: Shows copy modal
    - `showCopyModal(sourceDate)`: Shows enhanced copy modal
    - `executeCopy()`: Handles copy operation with loading states
    - `checkExistingItems()`: Validates target date
    - `closeModal(modalId)`: Closes modal and resets form
- Improved user experience with:
  - Date picker instead of text input
  - Copy options (nutrition data, descriptions)
  - Loading states and better error handling
  - Warning for past dates
  - Consistent UI across all copy interfaces

### Backend
- Route handler in `routes/admin.js`
- Uses existing `MenuItem.getDailyMenu()` method
- Uses `MenuItem.insertMany()` for bulk insertion
- Proper error handling and response formatting

### Database
- Leverages existing MenuItem model
- Maintains data integrity with proper validation
- Preserves all item relationships and metadata

## Security and Permissions
- Requires menu management permissions (`requireMenuPermission`)
- Only works for non-read-only dates
- Validates date ranges and permissions

## Future Enhancements
- Bulk copy to multiple dates
- Copy with modifications (e.g., adjust portions)
- Copy specific categories only
- Copy nutrition data separately
- Copy from templates or saved menus
- Enhanced copy modal with preview of items to be copied
- Copy with portion size adjustments
- Copy to multiple dates at once 