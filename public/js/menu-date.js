// Menu Date Management JavaScript
let menuItemsData = {};
let isReadOnly = false;

// Initialize with data from server
function initializeMenuData(data, readOnlyMode) {
    menuItemsData = data;
    isReadOnly = readOnlyMode;
}

function showAddForm(category = '') {
    if (!isReadOnly) {
        document.getElementById('addModal').style.display = 'block';
        if (category && category !== 'general') {
            document.getElementById('categorySelect').value = category;
        }
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    // Clear form
    if (modalId === 'addModal') {
        document.querySelector('#addModal form').reset();
    } else if (modalId === 'editModal') {
        document.querySelector('#editModal form').reset();
    } else if (modalId === 'copyModal') {
        // Reset copy modal
        document.getElementById('copyTargetDate').value = '';
        document.getElementById('copyNutrition').checked = true;
        document.getElementById('copyDescription').checked = true;
        document.getElementById('copyWarning').style.display = 'none';
    }
}

function editItem(itemId) {
    if (!isReadOnly) {
        // Find the item in the data
        let item = null;
        for (const category in menuItemsData) {
            const found = menuItemsData[category].find(i => i._id === itemId);
            if (found) {
                item = found;
                break;
            }
        }

        if (!item) {
            alert('Item not found');
            return;
        }

        // Populate the edit form
        document.getElementById('editItemId').value = item._id;
        document.getElementById('editName').value = item.name;
        document.getElementById('editCategorySelect').value = item.category;
        document.getElementById('editDescription').value = item.description || '';

        // Set the form action to the correct URL
        document.getElementById('editForm').action = `/admin/menu/${item._id}`;

        // Show the edit modal
        document.getElementById('editModal').style.display = 'block';
    }
}

function deleteItem(itemId) {
    if (!isReadOnly) {
        if (confirm('Are you sure you want to delete this menu item?')) {
            fetch(`/admin/menu/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('Error: ' + data.error);
                }
            })
            .catch(error => {
                alert('An error occurred while deleting the item');
            });
        }
    }
}

function copyToNextDate(selectedDate) {
    if (!isReadOnly) {
        // Calculate next date from the selected date
        const currentDate = new Date(selectedDate);
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        
        showCopyModal(selectedDate, nextDateStr);
    }
}

function copyToSpecificDate(selectedDate) {
    if (!isReadOnly) {
        showCopyModal(selectedDate);
    }
}

function showCopyModal(sourceDate, defaultTargetDate = '') {
    // Calculate total items
    let totalItems = 0;
    for (const category in menuItemsData) {
        totalItems += menuItemsData[category].length;
    }
    
    // Set modal content
    document.getElementById('copySourceDate').textContent = sourceDate;
    document.getElementById('copyItemCount').textContent = `${totalItems} items`;
    
    // Set default target date
    const targetDateInput = document.getElementById('copyTargetDate');
    if (defaultTargetDate) {
        targetDateInput.value = defaultTargetDate;
    } else {
        // Set to tomorrow by default
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        targetDateInput.value = tomorrow.toISOString().split('T')[0];
    }
    
    // Show modal
    document.getElementById('copyModal').style.display = 'block';
    
    // Add event listener for target date change to check for existing items
    targetDateInput.addEventListener('change', checkExistingItems);
}

function checkExistingItems() {
    const targetDate = document.getElementById('copyTargetDate').value;
    const warningBox = document.getElementById('copyWarning');
    
    if (!targetDate) {
        warningBox.style.display = 'none';
        return;
    }
    
    // Check if target date has existing items (this would require an API call)
    // For now, we'll just show a general warning for future dates
    const today = new Date().toISOString().split('T')[0];
    if (targetDate <= today) {
        warningBox.style.display = 'block';
        warningBox.querySelector('p').textContent = 'Warning: Target date is today or in the past.';
    } else {
        warningBox.style.display = 'none';
    }
}

function executeCopy() {
    const sourceDate = document.getElementById('copySourceDate').textContent;
    const targetDate = document.getElementById('copyTargetDate').value;
    const copyNutrition = document.getElementById('copyNutrition').checked;
    const copyDescription = document.getElementById('copyDescription').checked;
    
    if (!targetDate) {
        alert('Please select a target date');
        return;
    }
    
    // Validate target date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (targetDate < today) {
        if (!confirm('You are copying to a past date. Are you sure you want to continue?')) {
            return;
        }
    }
    
    // Show loading state
    const copyButton = document.querySelector('#copyModal .btn-success');
    const originalText = copyButton.textContent;
    copyButton.textContent = 'Copying...';
    copyButton.disabled = true;
    
    fetch('/admin/menu/copy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fromDate: sourceDate,
            toDate: targetDate
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeModal('copyModal');
            
            // Show success message with options
            const message = `Successfully copied ${data.data.itemCount} menu items to ${targetDate}`;
            if (confirm(message + '\n\nWould you like to view the copied menu?')) {
                window.location.href = `/admin/menu/date/${targetDate}`;
            }
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        alert('An error occurred while copying the menu');
    })
    .finally(() => {
        // Reset button state
        copyButton.textContent = originalText;
        copyButton.disabled = false;
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const addModal = document.getElementById('addModal');
    const editModal = document.getElementById('editModal');
    const copyModal = document.getElementById('copyModal');
    
    if (event.target === addModal) {
        addModal.style.display = 'none';
    }
    if (event.target === editModal) {
        editModal.style.display = 'none';
    }
    if (event.target === copyModal) {
        copyModal.style.display = 'none';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Handle edit form submission if form exists
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const itemId = formData.get('itemId');
            
            // Convert FormData to regular object
            const data = {};
            for (let [key, value] of formData.entries()) {
                if (key !== '_method' && key !== 'itemId') {
                    data[key] = value;
                }
            }
            
            fetch(`/admin/menu/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    closeModal('editModal');
                    location.reload(); // Refresh to show updated data
                } else {
                    alert('Error: ' + result.error);
                }
            })
            .catch(error => {
                alert('An error occurred while updating the item');
            });
        });
    }
});